# Power Scripts

Scripts that save me 2 mins everyday.

## Setup (new machine)

```bash
git clone <your-repo-url>
cd power_scripts

mkdir -p ~/.local/bin
ln -s "$(pwd)/gettree.sh" ~/.local/bin/gettree
ln -s "$(pwd)/gitsetup" ~/.local/bin/gitsetup
ln -s "$(pwd)/kbm/kbm" ~/.local/bin/kbm

# if ~/.local/bin is not on PATH yet:
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc

# enable tab autocomplete:
echo 'source /path/to/power_scripts/completions.bash' >> ~/.bashrc

source ~/.bashrc
```

---

## gettree

Generates a clean tree structure of the current project using the filesystem.
Ignores common junk folders (`node_modules`, `.git`, `dist`, `build`, `.turbo`).
Useful for understanding, documenting, or sharing project structure.

**Usage:**
```bash
gettree
```

---

## gitsetup

Automates GitHub repository setup from the terminal.
Creates a GitHub repo via `gh` CLI, sets visibility, and links remote origin.
Removes the need for manual `git init`, `remote add`, and browser setup.

**Usage:**
```bash
gitsetup          # interactive mode
gitsetup --y      # auto mode (uses folder name, private visibility)
```

**Requires:** [GitHub CLI](https://cli.github.com/) installed and authenticated (`gh auth login`)

---

## kbm

Manages GNOME custom keyboard shortcuts from a repo-tracked JSON config.
It only manages custom shortcuts; built-in GNOME shortcuts are checked for
conflicts but never changed.

Config:
```bash
kbm/keyboard-bindings.config.json
```

**Usage:**
```bash
kbm sync          # import/apply custom shortcuts without deleting extras
kbm sync -d       # sync and delete GNOME custom shortcuts missing from config
kbm validate      # validate config and conflicts without applying changes
kbm list          # list current GNOME custom shortcuts
```

On first run, if `custom-shortcuts` is empty, `kbm sync` imports existing GNOME
custom shortcuts into the config.
If `custom-shortcuts` is empty, `kbm sync -d` deletes all GNOME custom shortcuts.
Before any `sync -d` deletion, the latest backup is written to
`kbm/keyboard-bindings.backup.json`.

---

## Autocomplete

Tab completion is available for all scripts via `completions.bash`.
- `gitsetup` — completes the `--y` flag
- `kbm` — completes commands and `sync -d` / `sync --delete`
- Source the file in `.bashrc` as shown in setup above.
