# chrome-startup

Opens Google Chrome with a specific profile and a configurable set of tabs automatically on login.

## What it does

Reads a list of URLs from `urls.conf` and launches Chrome with all of them as tabs on startup, using a specified Chrome profile.

## Setup (new machine)

### 1. Clone the repo and navigate into it

```bash
cd ~/path/to/bootup-apps
```

### 2. Find your Chrome profile folder

```bash
grep -rl "yourmail@mail.com" ~/.config/google-chrome/*/Preferences | cut -d'/' -f6
```

### 3. Set your profile in the script

Edit `launch-chrome.sh` and update `CHROME_PROFILE` to match (e.g. `Default`, `Profile 1`).

### 4. Edit your URLs

Edit `urls.conf` — one URL per line, lines starting with `#` are ignored.

### 5. Symlink the .desktop file into GNOME autostart

⚠️ Run this from inside the `bootup-apps` folder:

```bash
ln -s "$(pwd)/chrome-startup/chrome-startup.desktop" ~/.config/autostart/chrome-startup.desktop
```

Verify the symlink was created correctly:

```bash
ls -la ~/.config/autostart/
```

### 6. Test it

```bash
bash chrome-startup/launch-chrome.sh
```

Chrome should open with your profile and all configured tabs.

## To update tabs

Just edit `urls.conf`. No other changes needed.
