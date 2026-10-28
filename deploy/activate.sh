#!/usr/bin/env bash
# Runs on the server. Immutable releases, two isolated slots, health-gated Nginx switch.
set -euo pipefail
ROOT=/root/codex-reset
ACTION="${1:-}"
RELEASE="${2:-}"
mkdir -p "$ROOT"
exec 9>"$ROOT/deploy.lock"
flock -n 9 || { echo 'Another deployment is running' >&2; exit 1; }
cd "$ROOT"
CURRENT="$(cat current-slot 2>/dev/null || true)"
case "$ACTION" in
  status) docker ps -a --filter name=codex-reset- --format '{{.Names}} {{.Status}} {{.Ports}}'; cat current-release 2>/dev/null || true; exit;;
  logs) test -n "$CURRENT"; docker logs --tail=100 "codex-reset-$CURRENT"; exit;;
  deploy) [[ "$RELEASE" =~ ^[0-9TZ]+-[0-9a-f]{12}$ ]] || exit 2;;
  rollback) test -f previous-slot; RELEASE="$(cat previous-release)";;
  *) echo 'Usage: activate.sh deploy RELEASE | rollback | status | logs' >&2; exit 2;;
esac
if [[ "$ACTION" == rollback ]]; then
  SLOT="$(cat previous-slot)"
elif [[ "$CURRENT" == blue ]]; then SLOT=green
else SLOT=blue
fi
case "$SLOT" in blue) PORT=8091;; green) PORT=8092;; *) exit 2;; esac
CONTAINER="codex-reset-$SLOT"
if [[ "$ACTION" == deploy ]]; then
  cd "$ROOT/releases/$RELEASE"
  python3 - <<'PY'
import hashlib,json,pathlib
manifest=json.loads(pathlib.Path('RELEASE.json').read_text())
for name,expected in manifest['files'].items():
    assert hashlib.sha256(pathlib.Path(name).read_bytes()).hexdigest()==expected, name
print('Release file hashes verified:', manifest['id'])
PY
  docker build -f deploy/Dockerfile -t "codex-reset:$RELEASE" .
  if docker container inspect "$CONTAINER" >/dev/null 2>&1; then
    [[ "$SLOT" != "$CURRENT" ]] || exit 2
    docker rm -f "$CONTAINER"
  fi
  docker run -d --name "$CONTAINER" --restart unless-stopped --init \
    --read-only --cap-drop ALL --security-opt no-new-privileges \
    --memory 192m --log-opt max-size=10m --log-opt max-file=3 \
    -p "127.0.0.1:$PORT:3000" "codex-reset:$RELEASE"
else
  docker start "$CONTAINER" >/dev/null
fi
cd "$ROOT"
READY=0
for i in $(seq 1 30); do
  if curl -fsS --max-time 3 "http://127.0.0.1:$PORT/__health" > candidate-health.json && \
    python3 -c 'import json,sys; d=json.load(open("candidate-health.json")); assert d["ok"] and d["release"]["id"]==sys.argv[1]' "$RELEASE"; then
    READY=1; break
  fi
  sleep 2
done
[[ "$READY" == 1 ]] || { docker logs --tail=40 "$CONTAINER"; exit 1; }
# The real upstream must work from inside the candidate before switching traffic.
curl -fsS --max-time 25 "http://127.0.0.1:$PORT/api/feed?locale=zh" > candidate-feed.json
python3 -c 'import json; d=json.load(open("candidate-feed.json")); assert isinstance(d.get("tweets"),list) and len(d["tweets"])>0'
HAD_PROXY=0
if [[ -f active-proxy.conf ]]; then cp active-proxy.conf proxy-before-deploy.conf; HAD_PROXY=1; fi
printf 'proxy_pass http://127.0.0.1:%s;\n' "$PORT" > active-proxy.conf.new
mv active-proxy.conf.new active-proxy.conf
if ! nginx -t || ! nginx -s reload; then
  if [[ "$HAD_PROXY" == 1 ]]; then mv proxy-before-deploy.conf active-proxy.conf; else rm -f active-proxy.conf; fi
  nginx -t && nginx -s reload || true
  exit 1
fi
# On a configured site, verify the actual TLS virtual host before accepting the release.
if grep -q active-proxy.conf /www/server/panel/vhost/nginx/codex-reset.conf 2>/dev/null; then
  SERVED=0
  # The origin serves a Cloudflare Origin CA certificate, which is signed by a private
  # root. Trust it explicitly when the root is installed; otherwise fall back to an
  # unverified loopback check (the public TLS is verified separately by check-deploy).
  LOOPBACK_TLS=(-k)
  if [[ -f /etc/ssl/certs/cloudflare-origin-ca.pem ]]; then
    LOOPBACK_TLS=(--cacert /etc/ssl/certs/cloudflare-origin-ca.pem)
  fi
  for i in $(seq 1 10); do
    if curl -fsS "${LOOPBACK_TLS[@]}" --noproxy '*' --max-time 5 --resolve codex-reset.opentunnel.asia:443:127.0.0.1 \
      https://codex-reset.opentunnel.asia/__health > served-health.json && \
      python3 -c 'import json,sys; assert json.load(open("served-health.json"))["release"]["id"]==sys.argv[1]' "$RELEASE"; then
      SERVED=1; break
    fi
    sleep 1
  done
  if [[ "$SERVED" != 1 ]]; then
    if [[ "$HAD_PROXY" == 1 ]]; then
      mv proxy-before-deploy.conf active-proxy.conf
      nginx -t && nginx -s reload
    fi
    echo 'TLS route verification failed; release not accepted' >&2
    exit 1
  fi
else
  echo 'Container ready. Initial domain/certificate/Nginx setup is still required.'
fi
if [[ -n "$CURRENT" ]]; then
  printf '%s\n' "$CURRENT" > previous-slot
  cp current-release previous-release
fi
printf '%s\n' "$SLOT" > current-slot
printf '%s\n' "$RELEASE" > current-release
ln -sfn "releases/$RELEASE" current
echo "Active: $CONTAINER, release: $RELEASE, loopback port: $PORT"
