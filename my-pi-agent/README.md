# my-pi-agent

Personal Pi setup inspired by `davis7dotsh/my-pi-setup`, customized for my workflow.

It includes:

- Explicit MCP manager via `/mcp`
- Saleshandy Claude-command compatibility via `/sh`
- Firecrawl `search` / `scrape` tools
- `ask_user` interactive question tool
- Git/productivity commands: `/diff`, `/lg`, `/usage`, `/history`
- Git status widget and token-per-second tracker
- `Ctrl+Alt+O` shortcut to open the current directory in Zed
- Gruvbox Dark Hard theme
- Current Pi keybindings in `keybindings.json`

## Install

This repo is the source of truth. Pi should load it through a symlink at `~/.pi/agent`.

```bash
# backup existing setup first if needed
mv ~/.pi/agent ~/.pi/agent.backup.$(date +%Y%m%d-%H%M%S)

# clone this repo anywhere you keep code, then symlink it
ln -s ~/prashant-workspace/workspace/my-pi-agent ~/.pi/agent
cd ~/.pi/agent
npm install
```

With the symlink, edit files in this repo and run `/reload` in Pi. No copy/sync step is needed.

## Secrets

Never commit real secrets. Use the checked-in example files as migration references:

```bash
cp .env.example ~/.pi/agent/.env        # Firecrawl/search tool envs
chmod 600 ~/.pi/agent/.env

cp mcp.env.example ~/.pi/agent/mcp.env  # MCP server envs
chmod 600 ~/.pi/agent/mcp.env
```

Fill in at least:

```env
# ~/.pi/agent/.env
FIRECRAWL_API_KEY=

# ~/.pi/agent/mcp.env
GRAFANA_URL=https://heimdall.saleshandy.com
GRAFANA_SERVICE_ACCOUNT_TOKEN=
```

Pi login/provider auth is normally restored by running `/login` on the new machine; local `auth.json`, `trust.json`, `sessions/`, `.env`, and `mcp.env` are gitignored.

## Extensions

### Firecrawl search

File:

```text
extensions/firecrawl-search.ts
```

Registers model tools:

```text
search
scrape
```

Requires:

```text
FIRECRAWL_API_KEY
```

### MCP manager

File:

```text
extensions/mcp-manager/index.ts
```

Commands:

```text
/mcp
/mcp list
/mcp status
/mcp enable grafana
/mcp disable grafana
/mcp disable --all
/mcp restart grafana
/mcp tools grafana
/mcp info grafana
/mcp logs grafana
```

MCPs are disabled by default. `/mcp` opens an interactive picker with arrow-key navigation.

Configured servers live in:

```text
mcp.json
```

Secrets live outside git in:

```text
mcp.env
```

### Saleshandy compatibility

File:

```text
extensions/saleshandy/index.ts
```

Inside a Saleshandy repo, run:

```text
/sh
```

It detects repo-local Claude config:

```text
CLAUDE.md
.claude/commands/*.md
.claude/agents/*.md
.claude/rules/*.md
.claude/skills/*/SKILL.md
```

Then these commands execute the repo's existing `.claude/commands/<command>.md` through Pi:

```text
/fix
/debug
/review
/verify
/e2e
/learn
/address-pr
/sh-plan
/spec-review
/autopsy
```

No repo changes are required.

### ask_user

File:

```text
extensions/ask-user.ts
```

Registers tool:

```text
ask_user
```

Lets the model ask structured multiple-choice questions with a TUI popup.

### Git/productivity

Files:

```text
extensions/diff.ts
extensions/lg.ts
extensions/usage.ts
extensions/history.ts
extensions/git-status-widget.ts
extensions/tps-tracker.ts
extensions/open-zed.ts
```

Commands:

```text
/diff
/diff list
/diff clear
/lg
/usage
/history
```

`/history` opens all Pi sessions across repos as `[thread] - [message count] - [path]`. It switches to the selected session and fuzzy-searches using only user-sent messages from each thread.

Always-on UI:

- git branch + unstaged file count widget
- token-per-second status tracker

Shortcuts:

- `Ctrl+Alt+O` opens the current directory in Zed

## Keybindings

Current Pi keybindings are checked in at:

```text
keybindings.json
```

After syncing this repo to `~/.pi/agent`, run `/reload` in Pi to apply changes.

## Theme

Active theme in `settings.json`:

```json
{
  "theme": "gruvbox-dark-hard"
}
```

Theme file:

```text
themes/gruvbox-dark-hard.json
```

## Reload

After changing extensions/themes/settings in a running Pi session:

```text
/reload
```

## Notes

- `auth.json`, `.env`, `mcp.env`, `sessions/`, `node_modules/`, and `bin/` are intentionally ignored.
- This setup is optimized for Pi, while preserving compatibility with Saleshandy repos that already have Claude Code workflows.
