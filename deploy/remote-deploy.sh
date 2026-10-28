#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
LOCAL_ENV="$(cd "$(dirname "$0")" && pwd)/.env.local"
if [[ -f "$LOCAL_ENV" ]]; then set -a; . "$LOCAL_ENV"; set +a; fi
SERVER_HOST="${SERVER_HOST:-}"
if [[ -z "$SERVER_HOST" ]]; then
  echo '缺少 SERVER_HOST：复制 deploy/.env.local.example 为 deploy/.env.local 并填入服务器地址（该文件已被 gitignore）。' >&2
  exit 2
fi
SERVER_USER="${SERVER_USER:-root}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/sketchive_deploy_ed25519}"
SSH_PORT="${SSH_PORT:-22}"
SSH=(ssh -i "$SSH_KEY" -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=15 -p "$SSH_PORT")
if [[ -n "${SSH_KNOWN_HOSTS_FILE:-}" ]]; then SSH+=(-o "UserKnownHostsFile=$SSH_KNOWN_HOSTS_FILE"); fi
SSH+=("$SERVER_USER@$SERVER_HOST")
ACTION="${1:-deploy}"
case "$ACTION" in
  status|logs|rollback) "${SSH[@]}" "bash /root/codex-reset/current/deploy/activate.sh $ACTION"; exit;;
  deploy) ;;
  *) echo 'Usage: remote-deploy.sh [deploy|status|logs|rollback]' >&2; exit 2;;
esac
npm run check
npm run check:server
npm run check:seo
npm run check:deploy
STAGING="$(mktemp -d /tmp/codex-reset-package.XXXXXX)"
trap 'rm -rf "$STAGING"' EXIT
RELEASE="$(node tools/package-release.js "$STAGING")"
[[ "$RELEASE" =~ ^[0-9TZ]+-[0-9a-f]{12}$ ]] || exit 2
"${SSH[@]}" "mkdir -p /root/codex-reset/releases; mkdir /root/codex-reset/releases/$RELEASE"
COPYFILE_DISABLE=1 tar --format=ustar -czf - -C "$STAGING" . | "${SSH[@]}" "tar xzf - -C /root/codex-reset/releases/$RELEASE"
"${SSH[@]}" "bash /root/codex-reset/releases/$RELEASE/deploy/activate.sh deploy $RELEASE"
node tools/verify-deployment.js "$STAGING/RELEASE.json"
echo "Deployed and verified $RELEASE: https://codex-reset.opentunnel.asia/"
