#!/bin/bash
# Code Studio — starts the local runner and opens the browser.
# Optional: pass a workspace folder, e.g.  ./code-studio.command ~/Desktop/Projects/codeforces
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
cd "$(dirname "$0")"
exec python3 code-studio.py "$@"
