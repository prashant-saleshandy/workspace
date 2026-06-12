# Workspace Launcher

A fast keyboard-driven workspace navigator for Ubuntu that lets you browse project folders and open them directly in your editor (Zed or VS Code).

The launcher is triggered with a keyboard shortcut (default: **Ctrl + Shift + K**) and provides a searchable folder navigator.

---

# Features

* Fast folder navigation
* Search projects instantly
* Open projects in **Zed** or **VS Code**
* Editor preference persists between sessions
* Create new folders from the launcher
* Keyboard-first workflow

---

# Project Structure

```
workspace_launcher/
├── workspace-launcher.sh
├── workspace-navigator.py
└── README.md
```

---

# Requirements

Ubuntu / Linux with:

* Python 3
* Tkinter
* Zed or VS Code

Install Tkinter if missing:

```
sudo apt install python3-tk
```

---

# Installation

## 1. Clone or copy the project

Example location:

```
mkdir -p ~/.local/workspace_launcher
cd ~/.local/workspace_launcher
```

Copy the files:

```
workspace-launcher.sh
workspace-navigator.py
```

---

## 2. Make the launcher executable

```
chmod +x ~/.local/workspace_launcher/workspace-launcher.sh
```

---

## 3. Test the launcher

Run:

```
~/.local/workspace_launcher/workspace-launcher.sh
```

The workspace navigator UI should appear.

---

# Configure Workspace Root

Inside `workspace-navigator.py`, edit this line:

```
self.base_path = Path("/home/YOUR_USERNAME/workspace")
```

Example:

```
self.base_path = Path("/home/john/projects")
```

---

# Setup Keyboard Shortcut (Ctrl + Shift + K)

Open terminal and run:

```
gsettings set org.gnome.settings-daemon.plugins.media-keys custom-keybindings \
"['/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/custom0/']"
```

Then configure the shortcut:

```
gsettings set org.gnome.settings-daemon.plugins.media-keys.custom-keybinding:/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/custom0/ name "Workspace Launcher"

gsettings set org.gnome.settings-daemon.plugins.media-keys.custom-keybinding:/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/custom0/ command "~/.local/workspace_launcher/workspace-launcher.sh"

gsettings set org.gnome.settings-daemon.plugins.media-keys.custom-keybinding:/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/custom0/ binding "<Primary><Shift>k"
```

Now press:

```
Ctrl + Shift + K
```

The launcher will open.

---

# Usage

Key bindings inside the launcher:

| Key              | Action                  |
| ---------------- | ----------------------- |
| ↑ ↓              | Navigate folders        |
| Enter            | Open folder             |
| Ctrl + Enter     | Open in selected editor |
| Ctrl + Shift + N | Create new folder       |
| Backspace        | Go back                 |
| Esc              | Close launcher          |

---

# Editor Selection

Use the radio buttons in the bottom-right corner to switch between:

* Zed
* VS Code

Your selection is stored in:

```
~/.config/workspace-navigator/config.json
```

---

# Customization Ideas

You can extend the launcher with:

* Terminal launcher
* Git branch preview
* Repo detection
* Fuzzy search
* Additional editors

---

# License

MIT
