#!/usr/bin/env bash
# Ingest wrapper for the maintainer's Mac (launchd, every 2 hours).
#
# Why here and not on a server: x.com returns 403 to datacenter IPs (verified
# from GitHub Actions) and the production box in mainland China cannot reach it
# at all. A residential connection with the local proxy can, so the collector
# runs on the machine that already has access — and pushes the data commit,
# which triggers the normal deploy workflow.
#
# The site itself never runs this; it stays self-contained.
set -euo pipefail

# launchd gives a minimal PATH, and this Mac's node comes from nvm, so resolve
# the binary explicitly instead of hoping it is on PATH.
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
NODE_BIN="$(command -v node || true)"
if [ -z "$NODE_BIN" ]; then
  NODE_BIN="$(ls -d "$HOME"/.nvm/versions/node/*/bin/node 2>/dev/null | sort -V | tail -1 || true)"
fi
if [ -z "$NODE_BIN" ] || [ ! -x "$NODE_BIN" ]; then
  echo "$LOG_PREFIX node not found; set CODEX_RESET_NODE"
  exit 1
fi
NODE_BIN="${CODEX_RESET_NODE:-$NODE_BIN}"

REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO"
LOG_PREFIX="[codex-reset ingest $(date -u +%Y-%m-%dT%H:%MZ)]"

# Local proxy, if one is listening. Node only uses these when
# NODE_USE_ENV_PROXY=1, and only this process gets them.
PROXY="${CODEX_RESET_PROXY:-http://127.0.0.1:7890}"
if (exec 3<>"/dev/tcp/127.0.0.1/${PROXY##*:}") 2>/dev/null; then
  export http_proxy="$PROXY" https_proxy="$PROXY" all_proxy="$PROXY"
  export HTTP_PROXY="$PROXY" HTTPS_PROXY="$PROXY" ALL_PROXY="$PROXY"
  export NODE_USE_ENV_PROXY=1
  echo "$LOG_PREFIX proxy: $PROXY"
else
  echo "$LOG_PREFIX proxy not listening at $PROXY — trying direct"
fi

# One run at a time; a scheduled run that overlaps is skipped, not queued.
LOCK="/tmp/codex-reset-ingest.lock"
if ! mkdir "$LOCK" 2>/dev/null; then
  echo "$LOG_PREFIX another ingest is running; skip"
  exit 0
fi
trap 'rmdir "$LOCK" 2>/dev/null || true' EXIT

# Keep the working tree predictable: the job only ever commits data/ledger.json.
if ! git diff --quiet; then
  echo "$LOG_PREFIX working tree is dirty; refusing to commit data automatically"
  exit 1
fi

git pull --rebase --quiet

notify_failure() {
  /usr/bin/osascript -e "display notification \"$1\" with title \"Codex Reset 数据采集失败\"" >/dev/null 2>&1 || true
}

if ! "$NODE_BIN" tools/ingest.js --apply; then
  echo "$LOG_PREFIX ingest failed; ledger left untouched"
  notify_failure "抓取失败，站点保持上一次数据"
  exit 1
fi

if git diff --quiet -- data/ledger.json; then
  echo "$LOG_PREFIX ledger already current"
  exit 0
fi

git add data/ledger.json
git commit -m "data: ingest public reset posts ($(date -u +%Y-%m-%dT%H:%MZ))"
if ! git push; then
  echo "$LOG_PREFIX push failed"
  notify_failure "提交推送失败，数据未上线"
  exit 1
fi
echo "$LOG_PREFIX pushed; deploy workflow will pick it up"
