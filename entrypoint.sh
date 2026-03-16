#!/bin/bash
# Write Claude Code OAuth credentials from env vars to the expected file locations.
# This allows Claude CLI to authenticate without interactive login.

CLAUDE_HOME="$HOME/.claude"
CLAUDE_JSON="$HOME/.claude.json"

mkdir -p "$CLAUDE_HOME"

# Write .credentials.json from CLAUDE_CREDENTIALS env var
if [ -n "$CLAUDE_CREDENTIALS" ]; then
  echo "$CLAUDE_CREDENTIALS" > "$CLAUDE_HOME/.credentials.json"
  echo "[entrypoint] Wrote Claude credentials to $CLAUDE_HOME/.credentials.json"
fi

# Write oauthAccount section to .claude.json from CLAUDE_OAUTH_ACCOUNT env var
if [ -n "$CLAUDE_OAUTH_ACCOUNT" ]; then
  echo "{\"oauthAccount\": $CLAUDE_OAUTH_ACCOUNT}" > "$CLAUDE_JSON"
  echo "[entrypoint] Wrote Claude account info to $CLAUDE_JSON"
fi

exec "$@"
