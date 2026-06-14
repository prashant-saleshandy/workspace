import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";

type ShState = {
	enabled: boolean;
	root?: string;
	commands: string[];
};

const KNOWN_COMMANDS = [
	"address-pr",
	"autopsy",
	"debug",
	"e2e",
	"fix",
	"learn",
	"review",
	"sh-plan",
	"sh-plan-old",
	"spec-review",
	"verify",
];

const state: ShState = {
	enabled: false,
	commands: [],
};

function findRepoRoot(start: string) {
	let current = start;
	while (true) {
		if (existsSync(join(current, ".claude")) || existsSync(join(current, "CLAUDE.md"))) {
			return current;
		}
		const parent = dirname(current);
		if (parent === current) return undefined;
		current = parent;
	}
}

function listMarkdownFiles(dir: string) {
	if (!existsSync(dir)) return [];
	return readdirSync(dir)
		.filter((name) => name.endsWith(".md"))
		.map((name) => name.slice(0, -3))
		.sort();
}

function listNestedSkillNames(dir: string) {
	if (!existsSync(dir)) return [];
	return readdirSync(dir)
		.filter((name) => {
			const skillPath = join(dir, name);
			return statSync(skillPath).isDirectory() && existsSync(join(skillPath, "SKILL.md"));
		})
		.sort();
}

function detect(root: string) {
	return {
		commands: listMarkdownFiles(join(root, ".claude", "commands")),
		agents: listMarkdownFiles(join(root, ".claude", "agents")),
		rules: listMarkdownFiles(join(root, ".claude", "rules")),
		skills: listNestedSkillNames(join(root, ".claude", "skills")),
		hasClaudeMd: existsSync(join(root, "CLAUDE.md")),
		hasClaudeDirClaudeMd: existsSync(join(root, ".claude", "CLAUDE.md")),
		hasLearning: existsSync(join(root, ".claude", "learning.md")),
	};
}

function readIfExists(path: string) {
	return existsSync(path) ? readFileSync(path, "utf8") : undefined;
}

function buildCommandPrompt(root: string, command: string, args: string) {
	const commandPath = join(root, ".claude", "commands", `${command}.md`);
	const commandDefinition = readIfExists(commandPath);
	if (!commandDefinition) return undefined;

	const detected = detect(root);
	const relativeCommandPath = relative(root, commandPath);
	const argText = args.trim() || "(no arguments provided)";

	return `You are running a Saleshandy Claude-command compatibility workflow inside Pi.

Execute the repo-local slash command: /${command}
Command file: ${relativeCommandPath}
Repo root: ${root}

User arguments:
${argText}

Command definition:
\`\`\`markdown
${commandDefinition.trim()}
\`\`\`

Compatibility rules for Pi:
- Treat the command definition above as authoritative for this repo.
- Use this repo's CLAUDE.md and .claude directory as the source of truth.
- If the command mentions a Claude subagent, read the matching file from .claude/agents/<agent>.md and perform that role inline in this Pi session.
- If the command mentions a skill, read the matching .claude/skills/<skill>/SKILL.md before using it.
- If the command mentions rules, read relevant files from .claude/rules/.
- If the command mentions superpowers:* workflows, translate them into equivalent step-by-step work in Pi. Do not assume the Superpowers plugin exists.
- Keep repo-specific behavior: use files and conventions from this current repo, not another Saleshandy repo.
- Do not modify .claude files unless the command explicitly requires learning/rule updates and the user has confirmed if confirmation is requested by the workflow.

Available repo-local Claude resources:
- CLAUDE.md: ${detected.hasClaudeMd ? "yes" : "no"}
- .claude/CLAUDE.md: ${detected.hasClaudeDirClaudeMd ? "yes" : "no"}
- .claude/learning.md: ${detected.hasLearning ? "yes" : "no"}
- commands: ${detected.commands.length ? detected.commands.map((name) => `/${name}`).join(", ") : "none"}
- agents: ${detected.agents.length ? detected.agents.join(", ") : "none"}
- rules: ${detected.rules.length ? detected.rules.join(", ") : "none"}
- skills: ${detected.skills.length ? detected.skills.join(", ") : "none"}

Now execute /${command} with the provided user arguments.`;
}

function statusText(root: string | undefined) {
	if (!root) return "Saleshandy mode is off.";
	const detected = detect(root);
	return [
		`Saleshandy mode: ${state.enabled ? "enabled" : "disabled"}`,
		`Repo root: ${root}`,
		"",
		"Detected:",
		`- CLAUDE.md: ${detected.hasClaudeMd ? "yes" : "no"}`,
		`- .claude/CLAUDE.md: ${detected.hasClaudeDirClaudeMd ? "yes" : "no"}`,
		`- .claude/learning.md: ${detected.hasLearning ? "yes" : "no"}`,
		`- commands (${detected.commands.length}): ${detected.commands.map((name) => `/${name}`).join(", ") || "none"}`,
		`- agents (${detected.agents.length}): ${detected.agents.join(", ") || "none"}`,
		`- rules (${detected.rules.length}): ${detected.rules.join(", ") || "none"}`,
		`- skills (${detected.skills.length}): ${detected.skills.join(", ") || "none"}`,
	].join("\n");
}

function ensureEnabled(ctx: { cwd: string; ui: { notify: (message: string, type?: "info" | "warning" | "error") => void } }) {
	if (state.enabled && state.root) return true;
	ctx.ui.notify("Saleshandy mode is not enabled. Run /sh first.", "warning");
	return false;
}

function enableForCwd(ctx: { cwd: string; ui: { notify: (message: string, type?: "info" | "warning" | "error") => void; setStatus: (key: string, value: string) => void } }) {
	const root = findRepoRoot(ctx.cwd);
	if (!root) {
		ctx.ui.notify("No Saleshandy/Claude setup found. Expected CLAUDE.md or .claude in this repo or a parent directory.", "error");
		return;
	}
	const detected = detect(root);
	if (!detected.commands.length) {
		ctx.ui.notify(`Found ${root}, but no .claude/commands/*.md files were found.`, "error");
		return;
	}
	state.enabled = true;
	state.root = root;
	state.commands = detected.commands;
	ctx.ui.setStatus("sh", `sh: ${basename(root)}`);
	ctx.ui.notify(statusText(root), "info");
}

export default function saleshandyClaudeCompat(pi: ExtensionAPI) {
	pi.on("session_start", (_event, ctx) => {
		state.enabled = false;
		state.root = undefined;
		state.commands = [];
		ctx.ui.setStatus("sh", "sh: off");
	});

	pi.registerCommand("sh", {
		description: "Enable/use Saleshandy Claude-command compatibility for this session",
		argumentHint: "[status|off|commands|run <command> <args>]",
		getArgumentCompletions: (prefix: string) => {
			const actions = ["status", "off", "commands", "reload", "run"];
			const words = prefix.trim().split(/\s+/).filter(Boolean);
			if (words.length <= 1 && !prefix.endsWith(" ")) {
				return actions.filter((action) => action.startsWith(words[0] ?? "")).map((action) => ({ value: action, label: action }));
			}
			return state.commands.map((name) => ({ value: name, label: `/${name}` }));
		},
		handler: async (args, ctx) => {
			const trimmed = args.trim();
			if (!trimmed || trimmed === "enable" || trimmed === "on" || trimmed === "reload") {
				enableForCwd(ctx);
				return;
			}
			if (trimmed === "status") {
				const root = state.root ?? findRepoRoot(ctx.cwd);
				ctx.ui.notify(statusText(root), "info");
				return;
			}
			if (trimmed === "off" || trimmed === "disable") {
				state.enabled = false;
				state.root = undefined;
				state.commands = [];
				ctx.ui.setStatus("sh", "sh: off");
				ctx.ui.notify("Saleshandy mode disabled for this session.", "info");
				return;
			}
			if (trimmed === "commands") {
				const root = state.root ?? findRepoRoot(ctx.cwd);
				if (!root) {
					ctx.ui.notify("No Saleshandy/Claude setup found.", "warning");
					return;
				}
				const commands = detect(root).commands;
				ctx.ui.notify(commands.map((name) => `/${name}`).join("\n") || "No commands found.", "info");
				return;
			}
			if (trimmed.startsWith("run ")) {
				const [, commandRaw = "", ...rest] = trimmed.split(/\s+/);
				const command = commandRaw.replace(/^\//, "");
				if (!state.enabled) enableForCwd(ctx);
				if (!state.root) return;
				const prompt = buildCommandPrompt(state.root, command, rest.join(" "));
				if (!prompt) {
					ctx.ui.notify(`/${command} is not available in this repo. No .claude/commands/${command}.md found.`, "warning");
					return;
				}
				pi.sendUserMessage(prompt);
				return;
			}
			ctx.ui.notify(`Unknown /sh action: ${trimmed}`, "warning");
		},
	});

	for (const command of KNOWN_COMMANDS) {
		pi.registerCommand(command, {
			description: `Run Saleshandy repo-local .claude/commands/${command}.md through Pi`,
			argumentHint: "[arguments]",
			handler: async (args, ctx) => {
				if (!ensureEnabled(ctx)) return;
				const root = state.root!;
				const prompt = buildCommandPrompt(root, command, args);
				if (!prompt) {
					ctx.ui.notify(`/${command} is not available in this repo. No .claude/commands/${command}.md found.`, "warning");
					return;
				}
				pi.sendUserMessage(prompt);
			},
		});
	}
}
