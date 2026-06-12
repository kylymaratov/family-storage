#!/usr/bin/env bash
#
# Run the whole Family Cloud stack locally, without systemd:
#
#   browser ──HTTPS──> Caddy (:443, Let's Encrypt via Cloudflare DNS-01)
#                         └──HTTP──> Go app (127.0.0.1:48080)
#
# Press Ctrl+C to stop both. The Let's Encrypt cert is cached under
# ~/.local/share/caddy and reused across runs (no re-issuance every time).
#
# Requirements:
#   - ./caddy  built with the cloudflare DNS plugin:
#       xcaddy build --with github.com/caddy-dns/cloudflare --output ./caddy
#   - deploy/caddy.env  with a valid CF_API_TOKEN (Zone:DNS:Edit on klmdev.one)
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(dirname "$SCRIPT_DIR")"
cd "$SERVER_DIR"

APP_BIN="$SERVER_DIR/familycloud"
CADDY_BIN="$SERVER_DIR/caddy"
ENV_FILE="$SCRIPT_DIR/caddy.env"
DOMAIN="familycloud.klmdev.one"
ACME_EMAIL="info@emplbee.com"

log()  { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m!! \033[0m %s\n' "$*"; }
die()  { printf '\033[1;31mERROR:\033[0m %s\n' "$*" >&2; exit 1; }

# --- 1. Cloudflare token ---------------------------------------------------
[ -f "$ENV_FILE" ] || die "$ENV_FILE not found"
set -a; . "$ENV_FILE"; set +a
[ -n "${CF_API_TOKEN:-}" ] && [ "$CF_API_TOKEN" != "replace-with-your-cloudflare-token" ] \
  || die "CF_API_TOKEN is empty/placeholder in $ENV_FILE"

# --- 2. Binaries -----------------------------------------------------------
log "Building the app..."
go build -o "$APP_BIN" .

[ -x "$CADDY_BIN" ] || die "caddy not found at $CADDY_BIN
  Build it: xcaddy build --with github.com/caddy-dns/cloudflare --output $CADDY_BIN"

"$CADDY_BIN" list-modules 2>/dev/null | grep -q 'dns.providers.cloudflare' \
  || die "this caddy build lacks the cloudflare DNS plugin; rebuild with xcaddy"

# --- 3. App must serve plain HTTP behind the proxy -------------------------
if [ -d "$SERVER_DIR/certs" ]; then
  log "Moving certs/ aside so the app serves HTTP (Caddy terminates TLS)..."
  mv "$SERVER_DIR/certs" "$SERVER_DIR/certs.disabled"
fi

# --- 4. Pick ports: privileged 443/80, else fall back to 8443/8080 --------
HTTPS_PORT=443
HTTP_PORT=80
has_cap=0
if command -v getcap >/dev/null 2>&1 \
   && getcap "$CADDY_BIN" 2>/dev/null | grep -q cap_net_bind_service; then
  has_cap=1
fi

if [ "$has_cap" -eq 0 ]; then
  if command -v setcap >/dev/null 2>&1; then
    log "Granting caddy the right to bind :80/:443 (sudo may prompt)..."
    if sudo setcap 'cap_net_bind_service=+ep' "$CADDY_BIN"; then
      log "setcap OK."
    else
      warn "No privileges for 443/80 — falling back to high ports."
      HTTPS_PORT=8443; HTTP_PORT=8080
    fi
  else
    warn "setcap unavailable — falling back to high ports."
    HTTPS_PORT=8443; HTTP_PORT=8080
  fi
fi

# --- 5. Build the effective Caddyfile --------------------------------------
GLOBAL_PORTS=""
if [ "$HTTPS_PORT" != "443" ]; then
  GLOBAL_PORTS=$(printf '\thttp_port %s\n\thttps_port %s\n' "$HTTP_PORT" "$HTTPS_PORT")
fi

CFG_TMP="$(mktemp /tmp/familycloud-caddy.XXXXXX)"
cat > "$CFG_TMP" <<EOF
{
	email $ACME_EMAIL
${GLOBAL_PORTS}
}

$DOMAIN {
	tls {
		dns cloudflare {env.CF_API_TOKEN}
		resolvers 1.1.1.1
	}
	encode zstd gzip
	request_body {
		max_size 10GiB
	}
	reverse_proxy 127.0.0.1:48080
}
EOF

# --- 6. Start the app, then Caddy in the foreground ------------------------
log "Starting Go app on 127.0.0.1:48080..."
FC_BIND=127.0.0.1 FC_PORT=48080 "$APP_BIN" &
APP_PID=$!

cleanup() {
  log "Shutting down..."
  kill "$APP_PID" 2>/dev/null || true
  rm -f "$CFG_TMP"
}
trap cleanup EXIT INT TERM

log "Waiting for the app to come up..."
for _ in $(seq 1 40); do
  code=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:48080/cloud/media 2>/dev/null || echo 000)
  if [ "$code" != "000" ]; then log "App is up (HTTP $code)."; break; fi
  sleep 0.5
done

log "Starting Caddy on :$HTTPS_PORT  ->  https://$DOMAIN"
if [ "$HTTPS_PORT" != "443" ]; then
  warn "Running on high port $HTTPS_PORT. Test from this machine with:"
  warn "  curl --resolve $DOMAIN:$HTTPS_PORT:127.0.0.1 https://$DOMAIN:$HTTPS_PORT/cloud/media"
else
  log "Make sure Cloudflare has  A $DOMAIN -> 192.168.0.111  (DNS only) for LAN devices."
fi

env CF_API_TOKEN="$CF_API_TOKEN" "$CADDY_BIN" run --config "$CFG_TMP" --adapter caddyfile
