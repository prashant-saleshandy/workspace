import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const CONFIG_PATH = join(homedir(), ".pi", "agent", "mcp.json");
const ENV_PATH = join(homedir(), ".pi", "agent", "mcp.env");
const MCP_PROTOCOL_VERSION = "2024-11-05";

type McpConfig = {
	servers: Record<string, McpServerConfig>;
};

type McpServerConfig = {
	type: "stdio";
	description?: string;
	command: string;
	args?: string[];
	env?: Record<string, string>;
	default?: "disabled";
};

type JsonRpcResponse = {
	jsonrpc: "2.0";
	id?: number;
	result?: unknown;
	error?: { code: number; message: string; data?: unknown };
	method?: string;
	params?: unknown;
};

type McpTool = {
	name: string;
	description?: string;
	inputSchema?: Record<string, unknown>;
};

type RunningServer = {
	name: string;
	config: McpServerConfig;
	process: ChildProcessWithoutNullStreams;
	tools: McpTool[];
	registeredToolNames: string[];
	pending: Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>;
	nextId: number;
	logs: string[];
	startedAt: number;
	buffer: string;
};

function loadDotEnv(path: string): Record<string, string> {
	if (!existsSync(path)) return {};
	const env: Record<string, string> = {};
	for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;
		const eq = trimmed.indexOf("=");
		if (eq === -1) continue;
		const key = trimmed.slice(0, eq).trim();
		let value = trimmed.slice(eq + 1).trim();
		if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
			value = value.slice(1, -1);
		}
		env[key] = value;
	}
	return env;
}

function loadConfig(): McpConfig {
	if (!existsSync(CONFIG_PATH)) return { servers: {} };
	return JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as McpConfig;
}

function resolveEnv(configEnv: Record<string, string> | undefined, fileEnv: Record<string, string>) {
	const resolved: Record<string, string> = {};
	for (const [key, value] of Object.entries(configEnv ?? {})) {
		if (value.startsWith("$") && value.length > 1) {
			const envKey = value.slice(1);
			resolved[key] = fileEnv[envKey] ?? process.env[envKey] ?? "";
		} else {
			resolved[key] = value;
		}
	}
	return resolved;
}

function sanitizeToolName(serverName: string, toolName: string) {
	const cleanServer = serverName.toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
	const cleanTool = toolName.toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
	return `mcp_${cleanServer}_${cleanTool}`.slice(0, 80);
}

function serverLabel(name: string, active: boolean, toolCount?: number) {
	const icon = active ? "●" : "○";
	const state = active ? `connected${toolCount === undefined ? "" : `, ${toolCount} tools`}` : "disabled";
	return `${icon} ${name.padEnd(14)} ${state}`;
}

function truncateLog(logs: string[]) {
	return logs.slice(-20).join("\n") || "No logs captured.";
}

function pushLog(server: RunningServer, line: string) {
	server.logs.push(line);
	if (server.logs.length > 100) server.logs.splice(0, server.logs.length - 100);
}

function send(server: RunningServer, method: string, params?: unknown): Promise<unknown> {
	const id = server.nextId++;
	const message = { jsonrpc: "2.0", id, method, params };
	return new Promise((resolve, reject) => {
		server.pending.set(id, { resolve, reject });
		server.process.stdin.write(`${JSON.stringify(message)}\n`);
		setTimeout(() => {
			if (!server.pending.has(id)) return;
			server.pending.delete(id);
			reject(new Error(`MCP request timed out: ${method}`));
		}, 30_000).unref();
	});
}

function notify(server: RunningServer, method: string, params?: unknown) {
	server.process.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method, params })}\n`);
}

function handleMessage(server: RunningServer, message: JsonRpcResponse) {
	if (typeof message.id !== "number") return;
	const pending = server.pending.get(message.id);
	if (!pending) return;
	server.pending.delete(message.id);
	if (message.error) {
		pending.reject(new Error(message.error.message));
		return;
	}
	pending.resolve(message.result);
}

function attachProcessHandlers(server: RunningServer) {
	server.process.stdout.on("data", (chunk: Buffer) => {
		server.buffer += chunk.toString("utf8");
		let newline = server.buffer.indexOf("\n");
		while (newline !== -1) {
			const line = server.buffer.slice(0, newline).trim();
			server.buffer = server.buffer.slice(newline + 1);
			if (line) {
				try {
					handleMessage(server, JSON.parse(line) as JsonRpcResponse);
				} catch {
					pushLog(server, line);
				}
			}
			newline = server.buffer.indexOf("\n");
		}
	});

	server.process.stderr.on("data", (chunk: Buffer) => {
		for (const line of chunk.toString("utf8").split(/\r?\n/)) {
			if (line.trim()) pushLog(server, line.trim());
		}
	});

	server.process.on("exit", (code, signal) => {
		pushLog(server, `process exited: code=${code ?? "null"} signal=${signal ?? "null"}`);
		for (const pending of server.pending.values()) pending.reject(new Error("MCP server exited"));
		server.pending.clear();
	});
}

function parseToolArgs(args: string) {
	const [actionRaw, ...rest] = args.trim().split(/\s+/).filter(Boolean);
	return { action: actionRaw?.toLowerCase(), target: rest[0]?.toLowerCase(), rest };
}

export default function mcpManager(pi: ExtensionAPI) {
	const running = new Map<string, RunningServer>();
	const registered = new Set<string>();
	let config = loadConfig();
	let envFile = loadDotEnv(ENV_PATH);
	let setUiStatus: ((key: string, value: string) => void) | undefined;

	function reloadFiles() {
		config = loadConfig();
		envFile = loadDotEnv(ENV_PATH);
	}

	function setStatus() {
		const active = [...running.keys()];
		setUiStatus?.("mcp", active.length ? `mcp: ${active.join(",")}` : "mcp: off");
	}

	function activeWithout(names: string[]) {
		const remove = new Set(names);
		return pi.getActiveTools().map((tool) => tool.name).filter((name) => !remove.has(name));
	}

	async function enableServer(name: string, ctx: { ui: { notify: (message: string, type?: "info" | "warning" | "error") => void } }) {
		reloadFiles();
		const serverConfig = config.servers[name];
		if (!serverConfig) throw new Error(`Unknown MCP server: ${name}`);
		if (running.has(name)) return running.get(name)!;

		const child = spawn(serverConfig.command, serverConfig.args ?? [], {
			env: { ...process.env, ...resolveEnv(serverConfig.env, envFile) },
			stdio: "pipe",
		});

		const server: RunningServer = {
			name,
			config: serverConfig,
			process: child,
			tools: [],
			registeredToolNames: [],
			pending: new Map(),
			nextId: 1,
			logs: [],
			startedAt: Date.now(),
			buffer: "",
		};

		attachProcessHandlers(server);
		running.set(name, server);
		setStatus();

		await send(server, "initialize", {
			protocolVersion: MCP_PROTOCOL_VERSION,
			capabilities: {},
			clientInfo: { name: "pi-mcp-manager", version: "0.1.0" },
		});
		notify(server, "notifications/initialized");

		const result = (await send(server, "tools/list", {})) as { tools?: McpTool[] };
		server.tools = result.tools ?? [];

		for (const tool of server.tools) {
			const piToolName = sanitizeToolName(name, tool.name);
			server.registeredToolNames.push(piToolName);
			if (!registered.has(piToolName)) {
				registered.add(piToolName);
				pi.registerTool({
					name: piToolName,
					label: `${name}: ${tool.name}`,
					description: tool.description ?? `Call ${tool.name} on ${name} MCP server`,
					promptSnippet: `Call ${tool.name} on the explicitly enabled ${name} MCP server`,
					promptGuidelines: [
						`Use ${piToolName} only when the user asks for ${name} MCP data or observability context.`,
					],
					parameters: (tool.inputSchema ?? { type: "object", properties: {}, additionalProperties: true }),
					async execute(_toolCallId, params) {
						const live = running.get(name);
						if (!live) {
							return {
								isError: true,
								content: [{ type: "text", text: `${name} MCP is disabled. Run /mcp enable ${name} first.` }],
							};
						}
						const callResult = await send(live, "tools/call", { name: tool.name, arguments: params });
						return {
							content: [{ type: "text", text: JSON.stringify(callResult, null, 2) }],
							details: callResult,
						};
					},
				});
			}
		}

		pi.setActiveTools([...new Set([...pi.getActiveTools().map((tool) => tool.name), ...server.registeredToolNames])]);
		ctx.ui.notify(`Enabled MCP server: ${name} (${server.tools.length} tools)`, "info");
		setStatus();
		return server;
	}

	async function disableServer(name: string) {
		const server = running.get(name);
		if (!server) return false;
		pi.setActiveTools(activeWithout(server.registeredToolNames));
		server.process.kill();
		running.delete(name);
		setStatus();
		return true;
	}

	function statusText() {
		reloadFiles();
		const names = Object.keys(config.servers).sort();
		if (!names.length) return `No MCP servers configured. Add servers to ${CONFIG_PATH}`;
		const active = names.filter((name) => running.has(name));
		const inactive = names.filter((name) => !running.has(name));
		return [
			"MCP Status",
			"",
			"Active:",
			...(active.length ? active.map((name) => `  ${name} — connected, ${running.get(name)!.tools.length} tools`) : ["  none"]),
			"",
			"Inactive:",
			...(inactive.length ? inactive.map((name) => `  ${name}`) : ["  none"]),
		].join("\n");
	}

	async function openPicker(ctx: { ui: { select: (title: string, items: string[]) => Promise<string | undefined>; notify: (message: string, type?: "info" | "warning" | "error") => void } }) {
		reloadFiles();
		const names = Object.keys(config.servers).sort();
		if (!names.length) {
			ctx.ui.notify(`No MCP servers configured. Add servers to ${CONFIG_PATH}`, "warning");
			return;
		}
		const labels = names.map((name) => serverLabel(name, running.has(name), running.get(name)?.tools.length));
		labels.push("──────────────");
		labels.push("Status");
		labels.push("Disable all");
		labels.push("Close");
		const choice = await ctx.ui.select("MCP Manager — ↑/↓ navigate, Enter select", labels);
		if (!choice || choice === "Close" || choice.startsWith("─")) return;
		if (choice === "Status") {
			ctx.ui.notify(statusText(), "info");
			return;
		}
		if (choice === "Disable all") {
			for (const name of [...running.keys()]) await disableServer(name);
			ctx.ui.notify("Disabled all MCP servers", "info");
			return;
		}
		const selected = names.find((name) => choice.includes(` ${name.padEnd(14)}`));
		if (!selected) return;
		if (running.has(selected)) {
			await disableServer(selected);
			ctx.ui.notify(`Disabled MCP server: ${selected}`, "info");
		} else {
			await enableServer(selected, ctx);
		}
	}

	pi.on("session_start", (_event, ctx) => {
		setUiStatus = ctx.ui.setStatus.bind(ctx.ui);
		setStatus();
	});
	pi.on("session_shutdown", async () => {
		for (const name of [...running.keys()]) await disableServer(name);
	});

	pi.registerCommand("mcp", {
		description: "Explicitly manage MCP servers: /mcp, /mcp list, /mcp enable <name>, /mcp disable <name>, /mcp status, /mcp tools <name>, /mcp logs <name>",
		getArgumentCompletions: (prefix: string) => {
			reloadFiles();
			const words = prefix.trim().split(/\s+/);
			const actions = ["list", "status", "enable", "disable", "restart", "tools", "info", "logs"];
			if (words.length <= 1 && !prefix.endsWith(" ")) {
				return actions.filter((action) => action.startsWith(words[0] ?? "")).map((action) => ({ value: action, label: action }));
			}
			return Object.keys(config.servers).sort().map((name) => ({ value: name, label: name }));
		},
		handler: async (args, ctx) => {
			setUiStatus = ctx.ui.setStatus.bind(ctx.ui);
			const { action, target } = parseToolArgs(args);
			try {
				if (!action) {
					await openPicker(ctx);
					return;
				}
				if (action === "list") {
					reloadFiles();
					const names = Object.keys(config.servers).sort();
					ctx.ui.notify(names.map((name) => serverLabel(name, running.has(name), running.get(name)?.tools.length)).join("\n") || "No MCP servers configured", "info");
					return;
				}
				if (action === "status") {
					ctx.ui.notify(statusText(), "info");
					return;
				}
				if (action === "enable" || action === "on") {
					if (!target) throw new Error("Usage: /mcp enable <server>");
					await enableServer(target, ctx);
					return;
				}
				if (action === "disable" || action === "off") {
					if (target === "--all" || target === "all") {
						for (const name of [...running.keys()]) await disableServer(name);
						ctx.ui.notify("Disabled all MCP servers", "info");
						return;
					}
					if (!target) throw new Error("Usage: /mcp disable <server|--all>");
					const disabled = await disableServer(target);
					ctx.ui.notify(disabled ? `Disabled MCP server: ${target}` : `${target} was not enabled`, disabled ? "info" : "warning");
					return;
				}
				if (action === "restart") {
					if (!target) throw new Error("Usage: /mcp restart <server>");
					await disableServer(target);
					await enableServer(target, ctx);
					return;
				}
				if (action === "tools") {
					if (!target) throw new Error("Usage: /mcp tools <server>");
					const wasRunning = running.has(target);
					const server = running.get(target) ?? await enableServer(target, ctx);
					ctx.ui.notify(server.tools.map((tool) => `${sanitizeToolName(target, tool.name)}\n  ${tool.description ?? "No description"}`).join("\n\n") || "No tools exposed", "info");
					if (!wasRunning) await disableServer(target);
					return;
				}
				if (action === "info") {
					if (!target) throw new Error("Usage: /mcp info <server>");
					reloadFiles();
					const serverConfig = config.servers[target];
					if (!serverConfig) throw new Error(`Unknown MCP server: ${target}`);
					const envKeys = Object.keys(serverConfig.env ?? {}).map((key) => `${key}: ${resolveEnv({ [key]: serverConfig.env![key] }, envFile)[key] ? "set" : "missing"}`);
					ctx.ui.notify([
						target,
						"",
						serverConfig.description ?? "No description",
						`Command: ${serverConfig.command} ${(serverConfig.args ?? []).join(" ")}`,
						`Status: ${running.has(target) ? "connected" : "disabled"}`,
						"Environment:",
						...(envKeys.length ? envKeys.map((line) => `  ${line}`) : ["  none"]),
					].join("\n"), "info");
					return;
				}
				if (action === "logs") {
					if (!target) throw new Error("Usage: /mcp logs <server>");
					const server = running.get(target);
					ctx.ui.notify(server ? truncateLog(server.logs) : `${target} is not running`, server ? "info" : "warning");
					return;
				}
				throw new Error(`Unknown /mcp action: ${action}`);
			} catch (error) {
				ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
			}
		},
	});
}
