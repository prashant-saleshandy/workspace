# Power Scripts

Scripts that save me 2 mins everyday.

## Setup (new machine)

```bash
git clone <your-repo-url>
cd power_scripts

mkdir -p ~/.local/bin
ln -s "$(pwd)/gettree.sh" ~/.local/bin/gettree
ln -s "$(pwd)/gitsetup" ~/.local/bin/gitsetup

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

## Autocomplete

Tab completion is available for all scripts via `completions.bash`.
- `gitsetup` — completes the `--y` flag
- Source the file in `.bashrc` as shown in setup above.

