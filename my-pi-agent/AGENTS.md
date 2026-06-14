# Personal Pi Agent Setup

- Be concise by default.
- Prefer reading relevant files before editing.
- Ask before large refactors or destructive actions.
- Run available check/lint/test commands after meaningful code changes.
- Do not expose secrets from .env, mcp.env, auth files, or session history.

## TypeScript

- Add packages using the package manager instead of manually editing package.json.
- Avoid `as any` unless absolutely necessary.
- Prefer inference over explicit return types unless clarity requires one.

## Saleshandy

Use `/sh` inside Saleshandy repos to enable compatibility with repo-local `.claude/commands/*` workflows.
