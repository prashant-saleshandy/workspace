# kbm

`kbm` manages GNOME custom keyboard shortcuts from a repo-tracked config.

It only manages custom shortcuts. Built-in GNOME shortcuts are read for conflict
checks, but they are never changed.

## Setup

Run this from inside `power_scripts`:

```bash
mkdir -p ~/.local/bin
ln -s "$(pwd)/kbm/kbm" ~/.local/bin/kbm
```

If `~/.local/bin` is not on your `PATH`, add it:

```bash
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
```

Enable autocomplete:

```bash
echo 'source /path/to/power_scripts/completions.bash' >> ~/.bashrc
source ~/.bashrc
```

## Config

Config lives at:

```text
power_scripts/kbm/keyboard-bindings.config.json
```

Default config:

```json
{
  "custom-shortcuts": {}
}
```

Shortcut example:

```json
{
  "custom-shortcuts": {
    "workspace-launcher": {
      "binding": "Ctrl+Shift+K",
      "command": "/home/prashantsingh/.local/workspace_launcher/workspace-launcher.sh"
    }
  }
}
```

`command` can be any command GNOME can run: a script path, an app command, or a
command with arguments.

## Usage

```bash
kbm sync
```

If `custom-shortcuts` is empty, this imports existing GNOME custom shortcuts into
the config. Otherwise it applies config shortcuts to GNOME and warns about GNOME
custom shortcuts that are not present in config.

```bash
kbm sync -d
```

Syncs and deletes GNOME custom shortcuts that are missing from config. If
`custom-shortcuts` is empty, this deletes all GNOME custom shortcuts. Deletion
only happens after validation passes.

Before deletion, the latest GNOME custom shortcut state is stored at:

```text
power_scripts/kbm/keyboard-bindings.backup.json
```

```bash
kbm validate
kbm list
kbm help
```

## Bindings

Bindings are case-insensitive and normalized.

These all become `Ctrl+Shift+K`:

```text
Ctrl+Shift+K
ctrl+shift+k
SHIFT + CTRL + k
control+shift+k
```

Malformed values like `Ctrl_____Shift-alt` are rejected.
