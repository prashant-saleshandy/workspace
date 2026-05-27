#!/bin/bash

# CONFIG
# Run: grep -rl "yourmail@mail.com" ~/.config/google-chrome/*/Preferences | cut -d'/' -f6
CHROME_PROFILE="Default"
URLS_FILE="$(dirname "$(realpath "$0")")/urls.conf"

# seconds to wait for desktop to fully load
DELAY_SECONDS=5

sleep "$DELAY_SECONDS"

mapfile -t URLS < <(grep -v '^\s*#' "$URLS_FILE" | grep -v '^\s*$')

if [ ${#URLS[@]} -eq 0 ]; then
    echo "No URLs found in $URLS_FILE"
    exit 1
fi

google-chrome --profile-directory="$CHROME_PROFILE" "${URLS[@]}"
