#!/bin/bash
# Auto-deploy watcher: monitors local code changes and syncs to Raspberry Pi 4
# Runs as systemd service: anthias-autodeploy
# Uses inotifywait to detect changes, debounces 5s, then rsyncs + restarts
#
# IMPORTANT: Uses include-based rsync — only syncs directories that are
# bind-mounted in docker-compose.yml. Pi-specific files (docker-compose.yml,
# staticfiles/) are NEVER touched.

set -euo pipefail

PI_HOST="pi@192.168.91.85"
PI_DIR="/home/pi/screenly"
LOCAL_DIR="/home/serv/Anthias/Antias Play"
COOLDOWN=5

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"; }

# Verify SSH before starting
if ! ssh -o ConnectTimeout=5 "$PI_HOST" true 2>/dev/null; then
    log "ERROR: Cannot connect to $PI_HOST — will retry in 30s"
    sleep 30
    exec "$0" "$@"
fi

# Run silent boot setup once (idempotent, skips if already done)
ssh "$PI_HOST" "sudo bash $PI_DIR/bin/setup-silent-boot.sh" 2>&1 || true

log "Watching $LOCAL_DIR for changes..."

inotifywait -m -r \
    --exclude '(\.git|node_modules|__pycache__|staticfiles|\.pyc$|\.swp$|~$)' \
    -e modify,create,delete,move \
    "$LOCAL_DIR" |
while read -r _dir _event _file; do
    log "Change detected: $_file ($_event)"

    # Debounce: drain events for COOLDOWN seconds
    while read -t "$COOLDOWN" -r _ _ _; do :; done

    log "Syncing to Pi..."

    if rsync -az \
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
        "$LOCAL_DIR/" "$PI_HOST:$PI_DIR/"; then
        log "Sync OK. Restarting server (collectstatic + gunicorn)..."
        if ssh "$PI_HOST" "cd $PI_DIR && docker compose restart anthias-server" 2>&1; then
            # Wait for gunicorn inside the container
            for i in $(seq 1 60); do
                if ssh "$PI_HOST" "docker exec screenly-anthias-server-1 curl -sf http://localhost:8080/api/v2/info > /dev/null 2>&1"; then
                    break
                fi
                sleep 1
            done
            ssh "$PI_HOST" "cd $PI_DIR && docker compose restart anthias-websocket && sleep 2 && docker compose restart anthias-nginx anthias-viewer" 2>&1
            log "All containers restarted. Deploy done."
        else
            log "WARNING: Container restart failed"
        fi
    else
        log "ERROR: rsync failed"
    fi
done
