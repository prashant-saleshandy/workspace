#!/bin/bash

# CONFIG
# Run: grep -rl "yourmail@mail.com" ~/.config/google-chrome/*/Preferences | cut -d'/' -f6
# Company profile for prashant@saleshandy.com is stored in Chrome directory: Profile 1
CHROME_PROFILE="Profile 1"
URLS_FILE="$(dirname "$(realpath "$0")")/urls.conf"
CHROME_USER_DATA_DIR="$HOME/.config/google-chrome"

# seconds to wait for desktop to fully load
DELAY_SECONDS=5

sleep "$DELAY_SECONDS"

if [ ! -d "$CHROME_USER_DATA_DIR/$CHROME_PROFILE" ]; then
    echo "Chrome profile directory not found: $CHROME_USER_DATA_DIR/$CHROME_PROFILE"
    echo "Not launching Chrome, because using a missing profile would create a new one."
    exit 1
fi

mapfile -t URLS < <(grep -v '^\s*#' "$URLS_FILE" | grep -v '^\s*$')

if [ ${#URLS[@]} -eq 0 ]; then
    echo "No URLs found in $URLS_FILE"
    exit 1
fi

google-chrome --profile-directory="$CHROME_PROFILE" "${URLS[@]}"
