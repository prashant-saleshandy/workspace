import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import type { ExtensionAPI, ExtensionCommandContext, SessionInfo } from "@earendil-works/pi-coding-agent";
import { SessionManager, SessionSelectorComponent } from "@earendil-works/pi-coding-agent";

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

async function withUserOnlySearchText(
	sessions: SessionInfo[],
	onProgress?: (loaded: number, total: number) => void,
): Promise<SessionInfo[]> {
	let loaded = 0;
	return Promise.all(
		sessions.map(async (session) => {
			try {
				return { ...session, allMessagesText: await extractUserMessagesText(session.path) };
			} catch {
				return { ...session, allMessagesText: session.firstMessage ?? "" };
			} finally {
				loaded++;
				onProgress?.(loaded, sessions.length);
			}
		}),
	);
}

async function listAllWithUserOnlySearch(onProgress?: (loaded: number, total: number) => void): Promise<SessionInfo[]> {
	const sessions = await SessionManager.listAll(onProgress);
	return withUserOnlySearchText(sessions, onProgress);
}

async function showHistory(ctx: ExtensionCommandContext): Promise<void> {
	await ctx.waitForIdle();

	try {
		const currentFile = ctx.sessionManager.getSessionFile();

		const selectedPath = await ctx.ui.custom<string | null>((tui, _theme, keybindings, done) => {
			const selector = new SessionSelectorComponent(
				// /history should open directly in the "All" view, so the current-folder
				// loader is intentionally empty and we toggle to All immediately below.
				async () => [],
				(onProgress) => listAllWithUserOnlySearch(onProgress),
				(path) => done(path),
				() => done(null),
				() => done(null),
				() => tui.requestRender(),
				{ showRenameHint: false, keybindings },
				currentFile,
			);

			// SessionSelectorComponent starts in "Current Folder" mode because it is the
			// same component used by /resume. Flip it to "All" on the next tick so the UI
			// is effectively the /resume All-sessions view, including search, sort,
			// threaded display, message counts, age, cwd, delete, and path toggle.
			queueMicrotask(() => {
				(selector as unknown as { toggleScope?: () => void }).toggleScope?.();
				tui.requestRender();
			});

			return selector;
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
		const message = error instanceof Error ? error.message : String(error);
		ctx.ui.notify(`Failed to open history: ${message}`, "error");
	}
}

export default function historyExtension(pi: ExtensionAPI) {
	pi.registerCommand("history", {
		description: "Show all pi sessions across all repos with the /resume UI, and switch to one",
		handler: async (_args, ctx) => {
			await showHistory(ctx);
		},
	});
}
