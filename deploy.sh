#!/usr/bin/env bash
# =============================================================================
# Skill Matrix — Droplet Deploy Script
# =============================================================================
# Run on a fresh Ubuntu 24.04 droplet:
#   curl -sSL https://raw.githubusercontent.com/YOU/skill-matrix/main/deploy.sh | bash
#
# Or after cloning:
#   chmod +x deploy.sh && ./deploy.sh
# =============================================================================

set -euo pipefail

echo "══════════════════════════════════════════════════════════"
echo "  Skill Matrix — Deployment"
echo "══════════════════════════════════════════════════════════"

# ─── 1. System updates & Docker install ───────────────────────────────────────
echo "[1/5] Installing Docker..."

if ! command -v docker &> /dev/null; then
    apt-get update -qq
    apt-get install -y -qq ca-certificates curl gnupg

    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg

    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources-list.d/docker.list > /dev/null

    apt-get update -qq
    apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

    systemctl enable docker
    systemctl start docker
    echo "  ✓ Docker installed"
else
    echo "  ✓ Docker already installed"
fi

# ─── 2. Firewall ─────────────────────────────────────────────────────────────
echo "[2/5] Configuring firewall..."

ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP (Caddy redirect)
ufw allow 443/tcp   # HTTPS
ufw allow 443/udp   # HTTP/3
ufw --force enable
echo "  ✓ Firewall configured (22, 80, 443)"

# ─── 3. Swap (useful on 4GB droplets under load) ─────────────────────────────
echo "[3/5] Setting up swap..."

if [ ! -f /swapfile ]; then
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
    echo "  ✓ 2GB swap created"
else
    echo "  ✓ Swap already exists"
fi

# ─── 4. Environment check ────────────────────────────────────────────────────
echo "[4/5] Checking environment..."

APP_DIR="/opt/skill-matrix"

if [ ! -f "$APP_DIR/.env" ]; then
    echo ""
    echo "  ⚠   No .env file found at $APP_DIR/.env"
    echo "  Copy your project to $APP_DIR and create .env from .env.example:"
    echo ""
    echo "    cp .env.example .env"
    echo "    nano .env              # Set DOMAIN and POSTGRES_PASSWORD"
    echo "    docker compose up -d"
    echo ""
    echo "  Or clone your repo:"
    echo "    git clone https://github.com/YOU/skill-matrix.git $APP_DIR"
    echo ""
    exit 0
fi

# ─── 5. Deploy ────────────────────────────────────────────────────────────────
echo "[5/5] Deploying..."

cd "$APP_DIR"

# Pull/build and start
docker compose pull
docker compose build --no-cache
docker compose up -d

echo ""
echo "══════════════════════════════════════════════════════════"
echo "  ✅ Deployed!"
echo ""
echo "  Your app will be live at https://$(grep DOMAIN .env | cut -d= -f2)"
echo "  Caddy will auto-provision SSL (may take ~30 seconds)."
echo ""
echo "  Useful commands:"
echo "    docker compose logs -f          # Watch all logs"
echo "    docker compose logs -f api      # Watch API logs"
echo "    docker compose ps               # Check status"
echo "    docker compose down             # Stop everything"
echo "    docker compose up -d --build    # Rebuild & restart"
echo ""
echo "  Database:"
echo "    docker compose exec db psql -U skillmatrix skill_matrix"
echo ""
echo "══════════════════════════════════════════════════════════"
