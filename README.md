# Quantus Network - Monitoring Stack

Prometheus + Grafana monitoring stack for Substrate-based blockchain nodes. Simple, unified configuration that works out of the box.

## Features

- 📊 **Prometheus** - Metrics collection and storage (60 days retention)
- 📈 **Grafana** - Metrics visualization with pre-configured dashboards
- 🖥️ **Node Exporter** - System metrics (CPU, RAM, Disk, Network)
- 🔒 **Nginx Reverse Proxy** - Prometheus protected with Basic Auth + Rate Limiting
- 🎯 **Network Dashboards** - Pre-configured dashboards for multiple blockchain networks
- 🎨 **Quantus Branding** - Custom logo, colors, and styling matching Quantus design
- ⚡ **Single Setup** - One configuration, works everywhere

## Quick Start

```bash
# 1. Clone repository
git clone <your-repo-url>
cd monitoring

# 2. (Optional) Customize credentials, SMTP, Telegram & alert emails
cp env.example .env
nano .env  # Set passwords, SMTP settings, Telegram, and ALERT_EMAIL_ADDRESSES

# 3. Start the stack
docker compose up -d

# 4. Access services
open http://localhost:3000       # Grafana (public dashboards, login: admin / admin)
open http://localhost:9091       # Prometheus (admin / prometheus)
```

That's it! 🎉

**Notes**:
- **Grafana**: Dashboards are publicly visible, but editing requires login (`admin` / `admin`)
- **Prometheus**: Secured with Basic Auth (`admin` / `prometheus`)

## Access URLs

- **Grafana**: http://localhost:3000 (dashboards visible to everyone, editing requires login)
- **Prometheus**: http://localhost:9091 (Basic Auth: `admin` / `prometheus`)
- **Node Exporter**: http://localhost:9100/metrics (metrics endpoint)

## What's Being Monitored?

The stack monitors:

- **Prometheus** - Self-monitoring (metrics collection system)
- **Node Exporter** - Docker host system metrics
  - CPU usage and load averages
  - Memory usage and availability
  - Disk usage and I/O
  - Network traffic (receive/transmit)
  - System uptime
- **Remote Blockchain Nodes** - Heisenberg and Dirac networks
  - Node metrics (system resources, peers, network I/O)
  - Substrate metrics (block production, finalization)
  - Mining metrics (hashrate, difficulty)
- **Support Services** - Telemetry and monitoring infrastructure
  - Telemetry Host (qm-telemetry.quantus.cat) - VPS system metrics
  - Telemetry Backend (feed-telemetry.quantus.cat) - Application metrics
    - Connected nodes/feeds/shards
    - Message rates and dropped messages
    - Service availability

## Adding Your Nodes

Edit `prometheus/prometheus.yml` to add your own node targets:

```yaml
scrape_configs:
  # Add your nodes here
  - job_name: 'my-validator'
    scrape_interval: 10s
    static_configs:
      - targets: ['validator1.example.com:9615']
        labels:
          instance: 'validator-1'
          chain: 'polkadot'
          role: 'validator'
```

Reload Prometheus:
```bash
# With authentication
curl -u admin:prometheus -X POST http://localhost:9091/-/reload
```

## Configuration

### Environment Variables

Optional - create `.env` from `.env.example`:

```bash
# Grafana Configuration
GRAFANA_ADMIN_PASSWORD=admin

# Prometheus Basic Auth (via Nginx)
# Credentials are generated at nginx container startup
PROMETHEUS_USER=admin
PROMETHEUS_PASSWORD=prometheus
```

**Security Tip**: For production, use strong credentials:
```bash
PROMETHEUS_USER=monitoring_$(openssl rand -hex 8)
PROMETHEUS_PASSWORD=$(openssl rand -base64 32)
```

### Email Notifications (SMTP)

To enable email notifications in Grafana, configure SMTP settings in your `.env` file:

```bash
# SMTP Configuration for Grafana Email Notifications
SMTP_ENABLED=true
SMTP_HOST=smtp.example.com:587
SMTP_USER=your-email@example.com
SMTP_PASSWORD=your_smtp_password_here
SMTP_FROM_ADDRESS=your-email@example.com
SMTP_FROM_NAME=Grafana Monitoring
SMTP_STARTTLS_POLICY=MandatoryStartTLS

# Alert Email Addresses (comma-separated)
ALERT_EMAIL_ADDRESSES=admin@example.com, alerts@example.com
```

**Note**: Copy `env.example` to `.env` and update with your SMTP credentials and alert email addresses:
```bash
cp env.example .env
nano .env  # Edit SMTP settings and ALERT_EMAIL_ADDRESSES
```

After configuring SMTP, restart Grafana:
```bash
docker compose restart grafana
```

To test email notifications:
1. Go to Grafana → Alerting → Contact points
2. Click "New contact point"
3. Select "Email" as the type
4. Enter test email address
5. Click "Test" to send a test email

### Telegram Notifications

Grafana has **built-in Telegram support** for instant mobile alerts. Critical alerts are automatically sent to both Telegram and Email.

**Setup Steps:**

**1. Create a Telegram Bot:**
```bash
# Open Telegram and message @BotFather
/newbot

# Follow the instructions
# You'll receive a bot token like: 123456789:ABCdefGHIjklMNOpqrsTUVwxyz
```

**2. Get your Chat ID:**
```bash
# Send any message to your bot in Telegram
# Then visit this URL in your browser (replace <YOUR_BOT_TOKEN>):
https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates

# Look for "chat":{"id":123456789} in the JSON response
# The number is your Chat ID
```

**3. Add to your `.env` file:**
```bash
# Telegram Configuration
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_CHAT_ID=123456789
```

**4. Restart Grafana:**
```bash
docker compose restart grafana
```

**Alert Routing (Already Configured):**
- 🔴 **Critical Alerts** → Telegram + Email
- 🟡 **Warning Alerts** → Email only
- **Dirac network** → Highest priority (2min wait, 30min repeat)
- **Heisenberg network** → Medium priority (10min wait, 2h repeat)

**Message Format:**
```
🚨 Node Down

Status: firing
Severity: critical
Chain: dirac
Instance: a1-qm-dirac.quantus.cat

📋 Node a1-qm-dirac.quantus.cat is DOWN
Node is down for more than 5 minutes - check immediately

🔗 View in Grafana
```

**To test:**
1. Go to Grafana → Alerting → Contact points
2. Find "Telegram Notifications"
3. Click "Test" to send a test message

**Note:** If you don't configure Telegram (leave variables empty), only Email notifications will be used.

### Alert Configuration (Provisioning)

Alerts are configured via provisioning files in `grafana/provisioning/alerting/`:

**Pre-configured Alerts:**

**Node Health:**
- 🔴 **Node Down** - Triggers when a node is unreachable for 5+ minutes
- 🔴 **No New Blocks** - Triggers when no new blocks produced for 3+ minutes
- 🟡 **Low Peer Count** - Triggers when peer count drops below 3

**System Resources:**
- 🔴 **Low Disk Space** - Triggers when disk usage exceeds 85%
- 🟡 **High CPU Usage** - Triggers when CPU usage exceeds 80% for 15+ minutes
- 🟡 **High Memory Usage** - Triggers when memory usage exceeds 90%

**Support Services:**
- 🔴 **Telemetry Host Down** - Triggers when telemetry host is unreachable for 5+ minutes

**Customizing Alert Email:**

Alert email addresses are configured in your `.env` file. Edit the `ALERT_EMAIL_ADDRESSES` variable:

```bash
# Single email
ALERT_EMAIL_ADDRESSES=your-email@example.com

# Multiple emails (comma-separated)
ALERT_EMAIL_ADDRESSES=email1@example.com, email2@example.com, team@example.com
```

After editing `.env`, rebuild and restart Grafana:
```bash
docker compose up -d --build grafana
```

**Adding Custom Alerts:**

Edit `grafana/provisioning/alerting/rules.yml`. Use the `reduce` + `threshold` pattern:

```yaml
- uid: custom-alert
  title: My Custom Alert
  condition: C  # Final threshold step
  data:
    # Step A: Prometheus query
    - refId: A
      datasourceUid: prometheus
      model:
        datasource:
          type: prometheus
          uid: prometheus
        expr: your_prometheus_query_here
        refId: A
        instant: false
        range: true
    
    # Step B: Reduce to single value
    - refId: B
      datasourceUid: __expr__
      model:
        datasource:
          type: __expr__
          uid: __expr__
        expression: A
        reducer: last  # or min, max, mean
        refId: B
        type: reduce
    
    # Step C: Threshold comparison
    - refId: C
      datasourceUid: __expr__
      model:
        datasource:
          type: __expr__
          uid: __expr__
        conditions:
          - evaluator:
              params: [threshold_value]
              type: gt  # gt (>), lt (<), eq (=)
            operator:
              type: and
            query:
              params: [C]
            reducer:
              params: []
              type: last
            type: query
        expression: B
        refId: C
        type: threshold
  for: 5m
  annotations:
    description: 'Alert description with {{ $value }}'
    summary: 'Alert summary'
  labels:
    severity: warning  # or critical
  notification_settings:
    receiver: Email Notifications
```

**Alert Notification Policies:**

Policies are configured in `grafana/provisioning/alerting/policies.yml` with different priorities for each network:

| Network | Priority | First Notification | Repeat Interval |
|---------|----------|-------------------|-----------------|
| **Dirac** 🔴 | Highest | 2 minutes | every 30 min |
| **Heisenberg** 🟡 | Medium | 10 minutes | every 2h |

Fallback by severity (if no chain label):
- **Critical alerts** (severity=critical): 10s wait, repeat every 1h
- **Warning alerts** (severity=warning): 30s wait, repeat every 4h

After changing alert configuration, restart Grafana:
```bash
docker compose restart grafana
```

**Troubleshooting Alert Provisioning:**

If you see errors like `UNIQUE constraint failed: alert_rule.guid`, it means alerts were already created in Grafana UI and conflict with provisioned alerts. To fix:

```bash
# Option 1: Reset Grafana data (loses all UI changes)
docker compose down
docker volume rm monitoring_grafana-data
docker compose up -d

# Option 2: Change UIDs in rules.yml if you want to keep existing alerts
# Edit each alert's 'uid' field to a unique value
```

**Note**: With provisioning, manage alerts through YAML files instead of the UI. UI changes may conflict with provisioned configuration.

### Adding Dashboards

Place JSON dashboard files in `grafana/dashboards/` directory. They will be automatically loaded on startup.

You can export dashboards from:
- [Grafana Dashboard Repository](https://grafana.com/grafana/dashboards/)
- Your existing Grafana instance

## Management Commands

### View Logs
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f prometheus
docker compose logs -f grafana
```

### Restart Services
```bash
# All services
docker compose restart

# Specific service
docker compose restart prometheus
```

### Stop Stack
```bash
# Stop services
docker compose down

# Stop and remove data volumes (caution!)
docker compose down -v
```

### Update Images
```bash
docker compose pull
docker compose up -d
```

## Data Persistence

- **Prometheus data**: Stored in Docker volume `prometheus-data` (60 days retention, 30GB max)
- **Grafana data**: Stored in Docker volume `grafana-data` (dashboards, datasources, settings)

To backup:
```bash
# Backup Prometheus
docker run --rm -v monitoring_prometheus-data:/data -v $(pwd):/backup alpine tar czf /backup/prometheus-backup.tar.gz /data

# Backup Grafana
docker run --rm -v monitoring_grafana-data:/data -v $(pwd):/backup alpine tar czf /backup/grafana-backup.tar.gz /data
```

## Quantus Branding & Customization

The monitoring stack is fully customized with Quantus branding:

### 🎨 Visual Branding

- **Custom Logo**: Quantus logo replaces default Grafana branding
- **Custom Favicon**: Quantus icon appears in browser tabs
- **App Title**: "Quantus Monitoring" instead of "Grafana"
- **Login Subtitle**: "Blockchain Network Monitoring"

### 🌈 Color Palette

The dashboards use Quantus color scheme:

- **Blue** (`#0000ff`, `#1f1fa3`) - Healthy/OK state
- **Pink** (`#ed4cce`) - Warning state
- **Yellow** (`#ffe91f`) - Critical state
- **Dark Background** (`#0c1014`) - Main background

### 📊 Dashboard Thresholds

**Last Block Time** (seconds):
- 🔵 Blue (< 3 min) - Normal block production
- 🩷 Pink (3-10 min) - Slow block production
- 💛 Yellow (> 10 min) - Critical delay

**Uptime** (percentage over 30 days):
- 🔵 Blue (> 90%) - Excellent availability
- 🩷 Pink (50-90%) - Degraded service
- 💛 Yellow (< 50%) - Critical downtime

### 🛠️ Customizing Branding

All branding assets are located in `grafana/branding/`:

```bash
grafana/branding/
├── logo.svg        # Quantus logo (SVG)
├── logo.png        # Quantus logo (PNG)
└── favicon.ico     # Browser favicon
```

To customize:
1. Replace files in `grafana/branding/` with your own
2. Restart Grafana: `docker compose restart grafana`
3. Hard refresh browser (Ctrl+Shift+R / Cmd+Shift+R)

Branding configuration is in `docker-compose.yml` under Grafana environment variables (`GF_BRANDING_*`).

## Project Structure

```
monitoring/
├── docker-compose.yml              # Main configuration
├── prometheus/
│   └── prometheus.yml              # Prometheus scrape configs
├── nginx/
│   ├── nginx.conf                  # Nginx reverse proxy config
│   ├── Dockerfile                  # Custom nginx image with htpasswd
│   └── docker-entrypoint.sh        # Auth generation script
├── grafana/
│   ├── dashboards/                 # Pre-loaded dashboards (by network)
│   │   ├── general/                # Welcome/overview dashboard
│   │   ├── system/                 # System monitoring dashboards
│   │   ├── heisenberg/
│   │   └── dirac/
│   ├── branding/                   # Quantus branding assets
│   │   ├── logo.svg                # Quantus logo (SVG)
│   │   ├── logo.png                # Quantus logo (PNG)
│   │   └── favicon.ico             # Browser favicon
│   └── provisioning/               # Auto-configuration
│       ├── datasources/            # Prometheus datasource
│       ├── dashboards/             # Dashboard providers
│       └── alerting/               # Alert configuration (provisioning)
│           ├── rules.yml           # Alert rules
│           ├── contactpoints.yml   # Contact points (email, etc.)
│           └── policies.yml        # Notification policies
├── .env.example                    # Environment variables template
├── .gitignore
└── README.md
```

## Included Dashboards

The stack comes with pre-configured dashboards organized by network:

### Quantus Network Overview (Home Dashboard)

**Welcome Dashboard** - First page you see when opening Grafana:
- Chain Height for all 3 networks
- Last Block Time (in seconds, color-coded)
- 30-day Uptime percentage (color-coded)
- **Support Services Status** - Quick status of telemetry infrastructure
  - Telemetry Host availability
  - Connected nodes count
- Visible without login
- Auto-refreshes every 10 seconds

Color indicators:
- 🔵 Blue = Healthy
- 🩷 Pink = Warning
- 💛 Yellow = Critical

### System Monitoring Dashboards

Located in the **System** folder:

**Localhost Monitoring** - Docker host system metrics:
- CPU Usage (current & over time)
- Memory Usage (current & over time)
- Disk Usage
- System Load (1m, 5m, 15m averages)
- Network I/O (receive/transmit)
- Disk I/O (read/write)
- System Uptime

**Telemetry Monitoring** - Telemetry infrastructure monitoring:
- **Host Metrics (VPS)**: CPU, memory, disk usage, network I/O, system load
- **Backend Metrics**: Connected feeds/nodes/shards, message rates, dropped messages
- Real-time status of telemetry collection infrastructure

Both use Quantus color scheme with dynamic thresholds.

### Per Network (Heisenberg, Dirac):
- **Node Metrics** - System resources, peers, network I/O
- **TXPool** - Transaction pool statistics
- **Business Metrics** - Block times, difficulty, chain height

Each dashboard shows:
- Block height (best & finalized)
- Connected peers
- Memory & CPU usage
- Network traffic
- Mining/validation metrics

Perfect for monitoring Substrate-based validators and full nodes.

## Customization

### Change Data Retention

Edit `docker-compose.yml`:
```yaml
services:
  prometheus:
    command:
      - '--storage.tsdb.retention.time=90d'  # Change retention period
      - '--storage.tsdb.retention.size=50GB'  # Change max size
```

### Expose Ports on Network

By default, services are accessible from localhost. To expose on your network, edit `docker-compose.yml`:

```yaml
ports:
  - "0.0.0.0:3000:3000"  # Instead of "3000:3000"
```

⚠️ **Security Warning**: If exposing on a network, consider adding authentication/firewall rules.

## Troubleshooting

### Prometheus not scraping targets

1. Check target status: http://localhost:9091/targets (use Basic Auth)
2. Verify target is accessible from Prometheus container
3. Check Prometheus logs: `docker compose logs prometheus`

### Prometheus UI shows "Too Many Requests"

This means rate limiting is too strict. Current settings allow 30 requests/second (burst 50), which should be enough. If you still see errors:
1. Check nginx logs: `docker compose logs nginx`
2. Adjust rate limits in `nginx/nginx.conf` if needed
3. Restart nginx: `docker compose restart nginx`

### Cannot access Prometheus (401 Unauthorized)

Prometheus is protected with Basic Auth. Use credentials from `.env`:
```bash
# Default credentials
Username: admin
Password: prometheus

# Or check your .env file
cat .env | grep PROMETHEUS
```

### Grafana shows "No Data"

1. Verify Prometheus datasource: Grafana → Configuration → Data Sources
2. Check if Prometheus is scraping: http://localhost:9091/targets (use Basic Auth)
3. Adjust time range in dashboard

### "host.docker.internal" not working

On Linux, add to each service in `docker-compose.yml`:
```yaml
extra_hosts:
  - "host.docker.internal:host-gateway"
```

### Node Exporter permission issues

If Node Exporter can't read system metrics, ensure proper volume mounts:
```yaml
volumes:
  - /proc:/host/proc:ro
  - /sys:/host/sys:ro
  - /:/host:ro
```

## Production Deployment

This stack includes built-in security (Nginx + Basic Auth + Rate Limiting). For production:

### Security Checklist:
1. ✅ **Prometheus Basic Auth** - Already configured (change credentials in `.env`)
2. ✅ **Rate Limiting** - 30 req/sec, prevents bruteforce attacks
3. ⚠️ **Strong Credentials** - Generate secure passwords:
   ```bash
   PROMETHEUS_USER=monitoring_$(openssl rand -hex 8)
   PROMETHEUS_PASSWORD=$(openssl rand -base64 32)
   ```
4. ⚠️ **SSL/TLS** - Use Cloudflare Tunnel or reverse proxy (Caddy, Traefik)
5. ⚠️ **Firewall** - Restrict ports or use VPN

### Recommended Setup with Cloudflare Tunnel:
```bash
# Prometheus is already secured with Basic Auth
# Add Cloudflare Tunnel for SSL + DDoS protection
# See: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/

# Your monitoring stays private, Cloudflare handles SSL
```

### Other Best Practices:
- **Increase retention** if needed: Edit `docker-compose.yml` storage settings
- **Setup backups** for Docker volumes
- **Monitor the monitoring** - Set up alerting for stack availability
- **Regular updates**: `docker compose pull && docker compose up -d`

### Changing Prometheus Credentials:
```bash
# 1. Edit .env
nano .env  # Change PROMETHEUS_USER and PROMETHEUS_PASSWORD

# 2. Restart nginx (generates new htpasswd)
docker compose restart nginx

# 3. Verify
curl -u newuser:newpass http://localhost:9091/
```

### Security Layers:
```
Internet → Cloudflare (SSL/DDoS) → Nginx (Auth/Rate Limit) → Prometheus
```
**Defense in Depth**: Basic Auth + Rate Limiting + Cloudflare = Enterprise-grade security

## Requirements

- Docker
- Docker Compose
- 2GB+ RAM recommended
- ~30GB disk space for default retention settings

## Compatible With

- Substrate
- Polkadot
- Kusama
- Any Substrate-based parachain
- Generic Prometheus metrics

## License

See [LICENSE](LICENSE) file for details.

## Contributing

Issues and pull requests welcome!

## Support

For Substrate/Polkadot metrics documentation:
- [Polkadot Metrics](https://wiki.polkadot.network/docs/maintain-guides-how-to-monitor-your-node)
