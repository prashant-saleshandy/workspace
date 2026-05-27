# bootup-apps

A collection of startup scripts and system hacks for Ubuntu. Stored here so they can be version-controlled and easily reproduced on a new machine.

## Structure

Each hack lives in its own folder and is fully self-contained.
Every folder has a `README.md` explaining what it does and how to wire it up on a fresh machine.

## Hacks

| Folder | What it does |
|---|---|
| `chrome-startup` | Opens Chrome with a specific profile and configured tabs on login |

## New machine setup

1. Clone this repo
2. Go into each hack's folder you want
3. Follow its `README.md` — typically just symlinking a `.desktop` file and editing one config value
