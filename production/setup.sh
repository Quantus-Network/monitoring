#!/bin/bash
set -e

echo "🚀 Quantus Network Monitoring Setup"
echo "===================================="

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "⚠️  Please run as root or with sudo"
    exit 1
fi

echo -e "${GREEN}✓${NC} Step 1: Updating system..."
dnf upgrade -y

echo -e "${GREEN}✓${NC} Step 2: Installing Docker..."
if ! command -v docker &> /dev/null; then
    dnf install -y docker
    systemctl enable --now docker
    echo -e "${GREEN}✓${NC} Docker installed"
else
    echo -e "${YELLOW}⊙${NC} Docker already installed"
fi

echo -e "${GREEN}✓${NC} Step 3: Installing Docker Compose..."
if ! docker compose version &> /dev/null; then
    dnf install -y docker-compose-plugin
    echo -e "${GREEN}✓${NC} Docker Compose installed"
else
    echo -e "${YELLOW}⊙${NC} Docker Compose already installed"
fi

echo -e "${GREEN}✓${NC} Step 4: Configuring firewall..."
if ! systemctl is-active --quiet firewalld; then
    systemctl enable --now firewalld
fi

# Block external access to monitoring ports (Cloudflare Tunnel handles access)
firewall-cmd --permanent --zone=public --remove-port=9090/tcp 2>/dev/null || true
firewall-cmd --permanent --zone=public --remove-port=3000/tcp 2>/dev/null || true
firewall-cmd --permanent --zone=public --remove-port=9100/tcp 2>/dev/null || true
firewall-cmd --reload

echo -e "${GREEN}✓${NC} Step 5: Setting up Cloudflared service..."
cat > /etc/systemd/system/cloudflared.service <<EOF
[Unit]
Description=Cloudflare Tunnel
After=network.target

[Service]
Type=simple
User=root
ExecStart=/usr/local/bin/cloudflared tunnel run monitoring
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable cloudflared
echo -e "${GREEN}✓${NC} Cloudflared service configured"

echo ""
echo -e "${GREEN}✓✓✓ Setup complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Copy your .cloudflared credentials to /root/.cloudflared/"
echo "2. Edit .env file and set strong Grafana password"
echo "3. Run: docker compose up -d"
echo "4. Run: systemctl start cloudflared"
echo ""
echo "Access URLs:"
echo "  Grafana:    https://grafana.monitoring.quantusnetwork.cloud"
echo "  Prometheus: https://prometheus.monitoring.quantusnetwork.cloud"

