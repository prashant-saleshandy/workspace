import { createReadStream } from "node:fs";
import { homedir } from "node:os";
import { createInterface } from "node:readline";
import type { ExtensionAPI, ExtensionCommandContext, SessionInfo } from "@earendil-works/pi-coding-agent";
import { DynamicBorder, SessionManager } from "@earendil-works/pi-coding-agent";
import { fuzzyMatch, Input, truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

type SessionWithSearch = SessionInfo & { userSearchText: string };

function extractText(content: unknown): string {
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";
	return content
		.filter((block): block is { type: string; text?: string } => {
			return typeof block === "object" && block !== null && (block as { type?: unknown }).type === "text";
		})
		.map((block) => block.text ?? "")
		.join(" ");
}

async function extractUserMessagesText(sessionPath: string): Promise<string> {
	const userMessages: string[] = [];
	const rl = createInterface({
		input: createReadStream(sessionPath, { encoding: "utf8" }),
		crlfDelay: Infinity,
	});

	for await (const line of rl) {
		if (!line.trim()) continue;
		try {
			const entry = JSON.parse(line) as { type?: string; message?: { role?: string; content?: unknown } };
			if (entry.type !== "message" || entry.message?.role !== "user") continue;
			const text = extractText(entry.message.content).replace(/\s+/g, " ").trim();
			if (text) userMessages.push(text);
		} catch {
			// Ignore malformed lines, same as pi's own session loader.
		}
	}

	return userMessages.join(" ");
}

async function listAllWithUserOnlySearch(onProgress?: (loaded: number, total: number) => void): Promise<SessionWithSearch[]> {
	const sessions = await SessionManager.listAll(onProgress);
	let loaded = 0;
	return Promise.all(
		sessions.map(async (session) => {
			try {
				return { ...session, userSearchText: await extractUserMessagesText(session.path) };
			} catch {
				return { ...session, userSearchText: session.firstMessage ?? "" };
			} finally {
				loaded++;
				onProgress?.(loaded, sessions.length);
			}
		}),
	);
}

function oneLine(text: string): string {
	return text.replace(/[\x00-\x1f\x7f]/g, " ").replace(/\s+/g, " ").trim() || "(no messages)";
}

function threadTitle(session: SessionInfo): string {
	return oneLine(session.name || session.firstMessage || "(no messages)");
}

function shortPath(path: string): string {
	const home = homedir();
	return path.startsWith(home) ? `~${path.slice(home.length)}` : path;
}

function formatAge(date: Date): string {
	const diffMs = Date.now() - date.getTime();
	const mins = Math.floor(diffMs / 60_000);
	const hours = Math.floor(diffMs / 3_600_000);
	const days = Math.floor(diffMs / 86_400_000);
	if (mins < 1) return "now";
	if (mins < 60) return `${mins}m`;
	if (hours < 24) return `${hours}h`;
	if (days < 7) return `${days}d`;
	if (days < 30) return `${Math.floor(days / 7)}w`;
	if (days < 365) return `${Math.floor(days / 30)}mo`;
	return `${Math.floor(days / 365)}y`;
}

function filterAndRankSessions(sessions: SessionWithSearch[], query: string): SessionWithSearch[] {
	const trimmed = query.trim();
	if (!trimmed) return sessions;

	const scored = sessions
		.map((session) => {
			// Fuzzy search over only user-sent messages, with a small title/id fallback so
			// named sessions remain findable without assistant text polluting matches.
			const searchText = `${session.userSearchText} ${session.name ?? ""} ${session.id}`;
			const match = fuzzyMatch(trimmed, searchText);
			return { session, match };
		})
		.filter((entry) => entry.match.matches);

	scored.sort((a, b) => {
		if (a.match.score !== b.match.score) return a.match.score - b.match.score;
		return b.session.modified.getTime() - a.session.modified.getTime();
	});

	return scored.map((entry) => entry.session);
}

function renderHistoryLine(session: SessionWithSearch, selected: boolean, width: number, theme: ExtensionCommandContext["ui"]["theme"]): string {
	const cursor = selected ? theme.fg("accent", "› ") : "  ";
	const count = `${session.messageCount} messages`;
	const path = shortPath(session.cwd || session.path);
	const age = formatAge(session.modified);
	const right = ` - ${count} - ${path} ${age}`;
	const titleWidth = Math.max(10, width - visibleWidth(cursor) - visibleWidth(right));
	let title = truncateToWidth(threadTitle(session), titleWidth, "…");
	if (session.name) title = theme.fg("warning", title);
	if (selected) title = theme.bold(title);
	const line = truncateToWidth(`${cursor}${title}${theme.fg("dim", right)}`, width, "");
	return selected ? theme.bg("selectedBg", line) : line;
}

async function showHistory(ctx: ExtensionCommandContext): Promise<void> {
	await ctx.waitForIdle();

	try {
		ctx.ui.setStatus("history", ctx.ui.theme.fg("accent", "loading history…"));
		const sessions = await listAllWithUserOnlySearch((loaded, total) => {
			ctx.ui.setStatus("history", ctx.ui.theme.fg("accent", `history ${loaded}/${total}`));
		});
		ctx.ui.setStatus("history", undefined);

		if (sessions.length === 0) {
			ctx.ui.notify("No pi sessions found.", "info");
			return;
		}

		const currentFile = ctx.sessionManager.getSessionFile();
		const selectedPath = await ctx.ui.custom<string | null>((tui, theme, keybindings, done) => {
			const input = new Input();
			let selectedIndex = 0;
			const maxVisible = 15;

			const currentFiltered = () => filterAndRankSessions(sessions, input.getValue());

			input.onSubmit = () => {
				const selected = currentFiltered()[selectedIndex];
				if (selected) done(selected.path);
			};

			return {
				render(width: number): string[] {
					const filtered = currentFiltered();
					const lines: string[] = [];
					lines.push(...new DynamicBorder((s: string) => theme.fg("accent", s)).render(width));
					lines.push(theme.fg("accent", theme.bold("Session History")));
					lines.push(theme.fg("dim", "Format: [thread] - [message count] - [path]"));
					lines.push(theme.fg("dim", "Search uses only user-sent messages from each thread."));
					lines.push(...input.render(width));
					lines.push("");

					if (filtered.length === 0) {
						lines.push(theme.fg("warning", "  No matching sessions"));
					} else {
						const start = Math.max(0, Math.min(selectedIndex - Math.floor(maxVisible / 2), filtered.length - maxVisible));
						const end = Math.min(start + maxVisible, filtered.length);
						for (let i = start; i < end; i++) {
							lines.push(renderHistoryLine(filtered[i], i === selectedIndex, width, theme));
						}
						if (start > 0 || end < filtered.length) {
							lines.push(theme.fg("muted", `  (${selectedIndex + 1}/${filtered.length})`));
						}
					}

					lines.push(theme.fg("dim", "↑↓ navigate • type to fuzzy search • enter open • esc cancel"));
					lines.push(...new DynamicBorder((s: string) => theme.fg("accent", s)).render(width));
					return lines.map((line) => truncateToWidth(line, width, ""));
				},
				invalidate() {},
				handleInput(data: string) {
					const filtered = currentFiltered();
					if (keybindings.matches(data, "tui.select.up")) {
						selectedIndex = Math.max(0, selectedIndex - 1);
						tui.requestRender();
						return;
					}
					if (keybindings.matches(data, "tui.select.down")) {
						selectedIndex = Math.min(Math.max(0, filtered.length - 1), selectedIndex + 1);
						tui.requestRender();
						return;
					}
					if (keybindings.matches(data, "tui.select.pageUp")) {
						selectedIndex = Math.max(0, selectedIndex - maxVisible);
						tui.requestRender();
						return;
					}
					if (keybindings.matches(data, "tui.select.pageDown")) {
						selectedIndex = Math.min(Math.max(0, filtered.length - 1), selectedIndex + maxVisible);
						tui.requestRender();
						return;
					}
					if (keybindings.matches(data, "tui.select.confirm")) {
						const selected = filtered[selectedIndex];
						if (selected) done(selected.path);
						return;
					}
					if (keybindings.matches(data, "tui.select.cancel")) {
						done(null);
						return;
					}
					const before = input.getValue();
					input.handleInput(data);
					if (input.getValue() !== before) selectedIndex = 0;
					tui.requestRender();
				},
			};
		});

		if (!selectedPath) return;
		if (selectedPath === currentFile) {
			ctx.ui.notify("Already on that session.", "info");
			return;
		}

		const result = await ctx.switchSession(selectedPath, {
			withSession: async (newCtx) => {
				newCtx.ui.notify(`Opened history session: ${selectedPath}`, "info");
			},
		});

		if (result.cancelled) {
			ctx.ui.notify("Session switch cancelled.", "warning");
		}
	} catch (error) {
		ctx.ui.setStatus("history", undefined);
		const message = error instanceof Error ? error.message : String(error);
		ctx.ui.notify(`Failed to open history: ${message}`, "error");
	}
}

export default function historyExtension(pi: ExtensionAPI) {
	pi.registerCommand("history", {
		description: "Show all pi sessions across repos as [thread] - [messages] - [path], fuzzy-searching user messages",
		handler: async (_args, ctx) => {
			await showHistory(ctx);
		},
	});
}
