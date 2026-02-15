#!/bin/bash
# Deploy Anthias Player code from local to Raspberry Pi 4
# Usage:
#   ./deploy-to-pi.sh          — sync all + restart containers
#   ./deploy-to-pi.sh --build  — build frontend first, then sync + restart
#   ./deploy-to-pi.sh --sync   — sync only, no container restart
#
# Bind-mounted dirs in docker-compose.yml (these are what matters):
#   static/dist/    → /usr/src/app/static/dist (server, nginx)
#   anthias_app/    → /usr/src/app/anthias_app (server, viewer)
#   api/            → /usr/src/app/api (server)
#   lib/            → /usr/src/app/lib (server)
#   viewer/media_player.py  → /usr/src/app/viewer/media_player.py (viewer)
#   viewer/scheduling.py    → /usr/src/app/viewer/scheduling.py (viewer)
#   staticfiles/    → /data/screenly/staticfiles (server, nginx) — auto-generated
#
# On container restart, collectstatic --clear regenerates staticfiles/ from static/dist/.

set -euo pipefail

PI_HOST="pi@192.168.91.85"
PI_DIR="/home/pi/screenly"
LOCAL_DIR="/home/serv/Anthias/Antias Play"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[DEPLOY]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
err() { echo -e "${RED}[ERROR]${NC} $1" >&2; }

# Parse args
BUILD=false
RESTART=true
for arg in "$@"; do
    case $arg in
        --build) BUILD=true ;;
        --sync) RESTART=false ;;
    esac
done

# Check SSH connectivity
if ! ssh -o ConnectTimeout=5 "$PI_HOST" true 2>/dev/null; then
    err "Cannot connect to $PI_HOST"
    exit 1
fi
log "Connected to Pi"

# Build frontend if requested
if $BUILD; then
    log "Building frontend..."
    cd "$LOCAL_DIR"
    npm run build
    log "Frontend built successfully"
fi

log "Syncing code to Pi..."

# Use include-based approach: only sync what Docker containers actually use.
# docker-compose.yml is Pi-specific and MUST NOT be overwritten.
rsync -avz \
    --include='api/***' \
    --include='anthias_app/***' \
    --include='anthias_django/***' \
    --include='lib/***' \
    --include='static/dist/***' \
    --include='static/sass/***' \
    --include='static/src/***' \
    --include='static/' \
    --include='templates/***' \
    --include='viewer/***' \
    --include='bin/***' \
    --include='requirements/***' \
    --include='settings.py' \
    --include='manage.py' \
    --include='celery_tasks.py' \
    --include='run_gunicorn.py' \
    --include='host_agent.py' \
    --include='websocket_server_layer.py' \
    --include='send_zmq_message.py' \
    --include='package.json' \
    --include='balena.yml' \
    --include='.dockerignore' \
    --include='.gitignore' \
    --include='.python-version' \
    --exclude='*' \
    "$LOCAL_DIR/" "$PI_HOST:$PI_DIR/"

log "Sync complete"

# Ensure viewer container has required bind mounts in docker-compose.yml
ensure_viewer_mounts() {
    local COMPOSE="$PI_DIR/docker-compose.yml"
    local CHANGED=false

    # scheduling.py mount
    if ! ssh "$PI_HOST" "grep -q 'scheduling.py:/usr/src/app/viewer/scheduling.py' $COMPOSE"; then
        log "Adding viewer/scheduling.py mount to docker-compose.yml"
        ssh "$PI_HOST" "sed -i 's|viewer/media_player.py:/usr/src/app/viewer/media_player.py:ro|viewer/media_player.py:/usr/src/app/viewer/media_player.py:ro\n      - /home/pi/screenly/viewer/scheduling.py:/usr/src/app/viewer/scheduling.py:ro|' $COMPOSE"
        CHANGED=true
    fi

    # viewer/__init__.py mount
    if ! ssh "$PI_HOST" "grep -q '__init__.py:/usr/src/app/viewer/__init__.py' $COMPOSE"; then
        log "Adding viewer/__init__.py mount to docker-compose.yml"
        ssh "$PI_HOST" "sed -i 's|viewer/scheduling.py:/usr/src/app/viewer/scheduling.py:ro|viewer/scheduling.py:/usr/src/app/viewer/scheduling.py:ro\n      - /home/pi/screenly/viewer/__init__.py:/usr/src/app/viewer/__init__.py:ro|' $COMPOSE"
        CHANGED=true
    fi

    # anthias_app mount for viewer (models needed by scheduling.py)
    if ! ssh "$PI_HOST" "sed -n '/anthias-viewer/,/depends_on/p' $COMPOSE | grep -q 'anthias_app:/usr/src/app/anthias_app'"; then
        log "Adding anthias_app mount to viewer in docker-compose.yml"
        ssh "$PI_HOST" "sed -i '/scheduling.py:\/usr\/src\/app\/viewer\/scheduling.py:ro/a\      - /home/pi/screenly/anthias_app:/usr/src/app/anthias_app:ro' $COMPOSE"
        CHANGED=true
    fi

    # websocket needs HOME=/data (default HOME=/root can't find screenly.conf)
    if ! ssh "$PI_HOST" "sed -n '/anthias-websocket/,/redis/p' $COMPOSE | grep -q 'HOME=/data'"; then
        log "Adding HOME=/data to websocket environment"
        ssh "$PI_HOST" "sed -i '/^  anthias-websocket:/,/^  [a-z]/{s/    restart: always/    restart: always\n    environment:\n      - HOME=\/data/}' $COMPOSE"
        CHANGED=true
    fi

    # nginx must depend on websocket (otherwise nginx crash-loops if websocket is not ready)
    if ! ssh "$PI_HOST" "sed -n '/anthias-nginx/,/anthias-viewer/p' $COMPOSE | grep -q 'anthias-websocket'"; then
        log "Adding websocket dependency to nginx in docker-compose.yml"
        ssh "$PI_HOST" "sed -i '/anthias-nginx/,/anthias-viewer/{s/      - anthias-server/      - anthias-server\n      - anthias-websocket/}' $COMPOSE"
        CHANGED=true
    fi

    if $CHANGED; then
        warn "docker-compose.yml updated — viewer needs recreation"
        ssh "$PI_HOST" "cd $PI_DIR && docker compose up -d anthias-viewer"
    fi
}
ensure_viewer_mounts

# Run silent boot setup on first deploy (idempotent, skips if already done)
log "Checking silent boot config..."
ssh "$PI_HOST" "sudo bash $PI_DIR/bin/setup-silent-boot.sh"

if $RESTART; then
    log "Restarting server container (runs collectstatic + gunicorn)..."
    ssh "$PI_HOST" "cd $PI_DIR && docker compose restart anthias-server"

    # Wait for gunicorn to be ready inside the container
    log "Waiting for server to start..."
    for i in $(seq 1 60); do
        if ssh "$PI_HOST" "docker exec screenly-anthias-server-1 curl -sf http://localhost:8080/api/v2/info > /dev/null 2>&1"; then
            log "Server is up!"
            break
        fi
        if [ "$i" -eq 60 ]; then
            warn "Server didn't respond after 60s — check logs: ssh $PI_HOST 'cd $PI_DIR && docker compose logs -f anthias-server'"
        fi
        sleep 1
    done

    log "Restarting websocket, nginx and viewer..."
    ssh "$PI_HOST" "cd $PI_DIR && docker compose restart anthias-websocket && sleep 2 && docker compose restart anthias-nginx anthias-viewer"
    sleep 2

    log "Deploy complete! Access: http://192.168.91.85"
else
    log "Sync-only mode — containers not restarted"
    warn "Run on Pi: cd ~/screenly && docker compose restart anthias-server anthias-nginx anthias-viewer"
fi
