#!/bin/bash

ROOT=$(basename "$PWD")
echo "$ROOT"

# Ignore patterns (extend as needed)
IGNORE_DIRS="node_modules|.git|dist|build|.turbo"

# Get all files (real filesystem)
FILES=$(find . -type f \
  | grep -Ev "/($IGNORE_DIRS)/" \
  | sed 's|^\./||')

# Always include .env (even if ignored above)
ENV_FILES=$(find . -type f -name ".env" | sed 's|^\./||')

# Merge + unique
FILES=$(printf "%s\n%s" "$FILES" "$ENV_FILES" | sort -u)

# Track printed folders to avoid duplicates
declare -A SEEN

for file in $FILES; do
    IFS='/' read -ra PARTS <<< "$file"

    PATH_ACC=""

    for ((i=0; i<${#PARTS[@]}; i++)); do
        PART="${PARTS[i]}"
        PATH_ACC="$PATH_ACC/$PART"

        # indentation
        INDENT=$(printf '%*s' $((i * 2)) '')

        if [[ $i -lt $((${#PARTS[@]} - 1)) ]]; then
            # folder
            if [[ -z "${SEEN[$PATH_ACC]}" ]]; then
                echo "${INDENT}|- $PART"
                SEEN[$PATH_ACC]=1
            fi
        else
            # file
            echo "${INDENT}|- $PART"
        fi
    done
done
