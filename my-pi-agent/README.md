# my-pi-agent

Personal Pi setup inspired by `davis7dotsh/my-pi-setup`, customized for my workflow.

It includes:

- Explicit MCP manager via `/mcp`
- Saleshandy Claude-command compatibility via `/sh`
- Firecrawl `search` / `scrape` tools
- `ask_user` interactive question tool
- Git/productivity commands: `/diff`, `/lg`, `/usage`
- Git status widget and token-per-second tracker
- Gruvbox Dark Hard theme

## Install

This repo is meant to be copied or symlinked into Pi's agent directory.

```bash
# backup existing setup first if needed
mv ~/.pi/agent ~/.pi/agent.backup.$(date +%Y%m%d-%H%M%S)

# clone/copy this repo as ~/.pi/agent
git clone <this-repo-url> ~/.pi/agent
cd ~/.pi/agent
npm install
```

If developing locally from this workspace:

```bash
cd ~/prashant-workspace/my-pi-agent
npm install
```

Then copy/sync into `~/.pi/agent` when ready.

## Secrets

Never commit real secrets.

Create local env files only in `~/.pi/agent`:

```bash
cp .env.example ~/.pi/agent/.env
chmod 600 ~/.pi/agent/.env

cp mcp.env.example ~/.pi/agent/mcp.env
chmod 600 ~/.pi/agent/mcp.env
```

Fill in:

```env
FIRECRAWL_API_KEY=
GRAFANA_SERVICE_ACCOUNT_TOKEN=
```

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
extensions/git-status-widget.ts
extensions/tps-tracker.ts
```

Commands:

```text
/diff
/diff list
/diff clear
/lg
/usage
```

Always-on UI:

- git branch + unstaged file count widget
- token-per-second status tracker

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
