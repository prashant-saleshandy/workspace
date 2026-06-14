# workspace

My personal workspace — a collection of productivity hacks, scripts, and tools for Ubuntu.
Everything here is version-controlled so it can be reproduced on any machine in minutes.

## Structure

Each project lives in its own folder and is fully self-contained.
Every folder has a `README.md` explaining what it does and how to wire it up on a fresh machine.

## Projects

| Folder | What it does |
|---|---|
| `bootup-apps` | Login/startup automation for Ubuntu, currently Chrome profile + tab launcher setup. |
| `launcher` | Keyboard-driven workspace navigator for opening projects in Zed or VS Code. |
| `my-pi-agent` | Personal Pi coding-agent setup: Firecrawl search/scrape, on-demand MCP manager, Saleshandy `/sh` Claude-command compatibility, productivity extensions, and themes. |
| `power_scripts` | CLI utility scripts: `gettree`, GitHub repo setup via `gitsetup`, GNOME keyboard shortcut manager `kbm`, and shell completions. |
| `sshfs-tunnel-same-network` | Notes and commands for SSH/SSHFS access between devices on the same local network. |

## New machine setup

1. Clone this repo
2. Go into each project folder you want
3. Follow its `README.md`
