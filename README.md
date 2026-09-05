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

# 2. (Optional) Customize credentials, SMTP, Telegram, Slack & alert emails
cp .env.example .env
nano .env  # Set passwords, SMTP, TELEGRAM_*, SLACK_WEBHOOK_URL, ALERT_EMAIL_ADDRESSES

# 3. Start the stack
docker compose up -d

# 4. Access services
open http://localhost:3000       # Grafana (login: admin / admin)
open http://localhost:9091       # Prometheus (admin / prometheus)
```

That's it! 🎉

**Notes**:
- **Grafana**: Login required (`admin` / `admin` by default). Anonymous access is disabled.
- **Public dashboards**: Use Grafana’s built-in Public Dashboard share for selected boards only (see [Public Dashboards](#public-dashboards)). Explore, alerting, and other dashboards stay private.
- **Prometheus**: Secured with Basic Auth (`admin` / `prometheus`)

## Access URLs

- **Grafana**: http://localhost:3000 (login required)
- **Prometheus**: http://localhost:9091 (Basic Auth: `admin` / `prometheus`)
- **Node Exporter**: http://localhost:9100/metrics (metrics endpoint)

## Public Dashboards

Grafana stays login-only (`GF_AUTH_ANONYMOUS_ENABLED=false`). To share a view without giving out credentials, use Grafana’s **Public dashboard** feature on the same instance (same host / Cloudflare Tunnel URL).

### Share a dashboard

1. Log in to Grafana and open the dashboard (e.g. **Overview → Service Status**).
2. Click **Share** → **Public dashboard**.
3. Enable the public link and copy the URL (`/public-dashboards/<accessToken>`).
4. Share that URL. Visitors can view that dashboard only — they cannot open Explore, alerting, or other dashboards without logging in.

Public share state is stored in Grafana’s database (not in the provisioned JSON). Enabling it once is enough; the token persists across restarts.

### What is safe to publish

| Safe to public-share | Keep private |
|----------------------|--------------|
| **Service Status** (uptime / operational status only) | Infrastructure host boards (CPU, mem, disk, network, hostnames) |
| Selected Chain boards that only show public chain health (e.g. Chain Health), after review | Applications boards with balances, process internals, or endpoint inventories (Faucet, Explorer, Graylog) |
| | Monitoring Stack, Support Host, and any board that exposes capacity or topology |

Do **not** public-share Quersi Host, Logs Host, Senoti Host, Subsquid Host, or other Infrastructure/Applications dashboards as-is.

## What's Being Monitored?

The stack monitors:

- **Prometheus** - Self-monitoring (metrics collection system)
- **Node Exporter** - Docker host system metrics
  - CPU usage and load averages
  - Memory usage and availability
  - Disk usage and I/O
  - Network traffic (receive/transmit)
  - System uptime
- **Remote Blockchain Nodes** - Planck, Heisenberg, staging bootnode, and staging rpcnode fleets
  - Node metrics (system resources, peers, network I/O)
  - Substrate metrics (block production, finalization)
  - Mining metrics (hashrate, difficulty)
  - Staging bootnode (`a1`–`a7`) and staging rpcnode (`rpc1`/`rpc2`) scrapes use Cloudflare Access headers (same `http_headers` block as senoti/quersi)
- **Subsquid / Explorer** - Planck testnet and staging mainnet fleets (`planck-subsquid-*`, `staging-subsquid-*`)
  - Processor Prometheus on `subsquid-proc-1` / `subsquid-mainnet-proc-1` (active-color indexer)
  - node_exporter on app, chain, and both DB colors (`subsquid-*.quantus.com` / `subsquid-mainnet-*.quantus.com`)
  - Staging scrapes use the same Cloudflare Access headers as senoti/quersi
- **Support Services** - Telemetry and monitoring infrastructure
  - Telemetry Host (qm-telemetry.quantus.cat) - VPS system metrics
  - Telemetry Backend (feed-telemetry.quantus.cat) - Application metrics
    - Connected nodes/feeds/shards
    - Message rates and dropped messages
    - Service availability
  - Logs Host (hm-logs.quantus.cat) - VPS system metrics
  - Graylog (qm-logs.quantus.cat) - Ingest, journal, indexer failures, JVM heap

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

### Scraping metrics behind Cloudflare Access

`CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET` are **required** — `docker compose` will fail if either is missing or empty. Set them in `.env`:

```bash
CF_ACCESS_CLIENT_ID=your_client_id
CF_ACCESS_CLIENT_SECRET=your_client_secret
```

On start, Prometheus writes these into `/etc/prometheus/secrets/`. For any scrape job protected by Access, add the same `http_headers` block used on `telemetry-host` in `prometheus/prometheus.yml`:

```yaml
http_headers:
  CF-Access-Client-Id:
    files:
      - /etc/prometheus/secrets/cf_access_client_id
  CF-Access-Client-Secret:
    files:
      - /etc/prometheus/secrets/cf_access_client_secret
```

Then recreate Prometheus (so secrets are rewritten) and reload if you only changed the YAML:

```bash
docker compose up -d prometheus
curl -u admin:prometheus -X POST http://localhost:9091/-/reload
```

## Configuration

### Environment Variables

Optional - create `.env` from `.env.example`:

```bash
cp .env.example .env
```

Key variables (see `.env.example` for the full list, including SMTP, Telegram, and Slack):

```bash
# Grafana Configuration
GRAFANA_ADMIN_PASSWORD=admin

# Prometheus Basic Auth (via Nginx)
# Credentials are generated at nginx container startup
PROMETHEUS_USER=admin
PROMETHEUS_PASSWORD=prometheus

# Cloudflare Access service token (protected /metrics scrapes)
CF_ACCESS_CLIENT_ID=
CF_ACCESS_CLIENT_SECRET=

# Production alert routing (see Alert Routing below)
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
SLACK_WEBHOOK_URL=
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
SMTP_FROM_NAME="Grafana Monitoring"
SMTP_STARTTLS_POLICY=MandatoryStartTLS

# Alert Email Addresses (comma-separated)
ALERT_EMAIL_ADDRESSES=admin@example.com, alerts@example.com
```

**Note**: Copy `.env.example` to `.env` and update with your SMTP credentials and alert email addresses:
```bash
cp .env.example .env
nano .env  # Edit SMTP settings and ALERT_EMAIL_ADDRESSES
```

After configuring SMTP, recreate Grafana so it picks up the new env:
```bash
docker compose up -d grafana
```

To test email notifications:
1. Go to Grafana → Alerting → Contact points
2. Click "New contact point"
3. Select "Email" as the type
4. Enter test email address
5. Click "Test" to send a test email

### Telegram Notifications

Grafana has **built-in Telegram support** for the highest-priority business alert: **No New Blocks** (critical). Other critical alerts go to Email only; warnings go to Slack.

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

**4. Recreate Grafana** (reloads `.env`; use `--build` if you also changed contact-point files):
```bash
docker compose up -d --build grafana
```

**Message Format:**
```
🚨 No New Blocks

Status: firing
Severity: critical
Chain: planck
Instance: a1-qm-planck.quantus.cat

📋 No new blocks on planck for 7+ minutes
Check block production immediately

🔗 View in Grafana
```

**To test:**
1. Go to Grafana → Alerting → Contact points
2. Find "Telegram Notifications"
3. Click "Test" to send a test message

### Slack Notifications

Non-critical alerts (warnings and chain-matched non-critical routes) go to **Slack** via Grafana’s built-in Slack contact point and an Incoming Webhook.

**Setup Steps:**

1. Create a Slack app at [api.slack.com/apps](https://api.slack.com/apps) (or reuse an existing one).
2. Enable **Incoming Webhooks** and add a webhook for the alerts channel.
3. Copy the webhook URL into your `.env` file:

```bash
# Slack Incoming Webhook
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/T000/B000/XXXX
```

4. Recreate Grafana so it picks up the new env and baked-in contact-point config:

```bash
docker compose up -d --build grafana
```

**Message Format:**
```
🚨 High CPU Usage — FIRING
Severity: warning
Chain: planck
Instance: example-host

📋 CPU usage high
…
🔗 View in Grafana
```

Resolved alerts use a green attachment; firing uses red.

**To test:**
1. Go to Grafana → Alerting → Contact points
2. Find "Slack Notifications"
3. Click "Test" and confirm a message appears in the Slack channel
4. Optionally resolve a real warning alert and confirm the green resolved message

### Daily Slack Dashboard Reports

Opt-in profile that renders full Grafana dashboards (last 24 hours by default) and posts one image per dashboard to Slack. Uses `grafana-image-renderer` (Chromium) — separate from alert **webhooks** (`SLACK_WEBHOOK_URL`).

**Enable:**

```bash
# Set GRAFANA_TOKEN, SLACK_BOT_TOKEN, SLACK_CHANNEL, SLACK_REPORT_DASHBOARDS in .env
docker compose --profile slack-report up -d --build
```

**Grafana token:** Administration → Service accounts → create a Viewer account → Add token → put it in `GRAFANA_TOKEN`.

**Slack bot:** Create or reuse a Slack app with Bot Token Scopes `files:write` and `chat:write`. Install the app, copy the Bot User OAuth Token into `SLACK_BOT_TOKEN`, invite the bot to the channel, and set `SLACK_CHANNEL` to the channel **ID** (e.g. `C0123456789`, not `#alerts`).

**Dashboard list** (`SLACK_REPORT_DASHBOARDS`) — comma-separated UIDs; append query params for template variables:

```bash
SLACK_REPORT_DASHBOARDS=welcome-overview,service-status,chain-health?var-chain=planck,chain-health?var-chain=heisenberg
```

**Schedule:** default `0 8 * * *` (08:00) in `SLACK_REPORT_TZ` (default `UTC`). Override with `SLACK_REPORT_CRON` / `SLACK_REPORT_TZ`.

**Image format:** Grafana always renders PNG; the script compresses before upload (`SLACK_REPORT_FORMAT=jpeg` default, or `webp` / `png`). JPEG is recommended for Slack inline preview.

**Manual test** (without waiting for cron):

```bash
docker compose --profile slack-report run --rm slack-report /usr/local/bin/slack-report.sh
```

You can also run `slack-report/slack-report.sh` on the host if `curl`, `jq`, and ImageMagick/`cwebp` are installed and `.env` is filled in (use a reachable `GRAFANA_URL`, e.g. `http://localhost:3000`).

### Alert Routing

When **both** Telegram (`TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID`) and `SLACK_WEBHOOK_URL` are set, Grafana loads production policies (`policies.production.yml`):

- 🔴 **No New Blocks** (critical) → Email + Telegram
- 🔴 **Other critical** → Email only
- 🟡 **Warnings / non-critical** → Slack
- Default receiver → Slack
- **Planck**, **staging_mainnet** (bootnode + rpcnode) → 2 min `group_wait`
- **Heisenberg** → 10 min `group_wait`

If either Telegram or Slack is missing, Grafana falls back to email-only local policies (`policies.local.yml`). Contact points for whichever channels are configured are still provisioned, but routing only uses Email until both are set.

### Alert Configuration (Provisioning)

Alerts are configured via provisioning files in `grafana/provisioning/alerting/`:

**Pre-configured Alerts:**

**Node Health:**
- 🔴 **Node Down** - Triggers when a `*-node`, `*-chain`, or `*-substrate` scrape is down for 5+ minutes
- 🔴 **No New Blocks** - Fires when no new blocks have been produced for 7+ minutes (rule); first Telegram notification arrives ~10 min after the last block (7 min threshold + 1 min `for:` + ~2 min `group_wait`). Staging RPC nodes do not export `last_block_time`; they use a dedicated best-block height stall (`delta(...)[7m] < 1`)
- 🟡 **Low Peer Count** - Triggers when peer count drops below 2 (all non-Heisenberg chains, including staging_mainnet)

**System Resources:**
- 🔴 **Low Disk Space** - Triggers when disk usage exceeds 85%
- 🟡 **High CPU Usage** - Triggers when CPU usage exceeds 80% for 15+ minutes
- 🟡 **High Memory Usage** - Triggers when memory usage exceeds 90%

**Support Services:**
- 🔴 **Telemetry Host Down** - Triggers when telemetry host is unreachable for 5+ minutes
- 🔴 **Logs Host Down** - Triggers when the logs VPS is unreachable for 3+ minutes
- 🔴 **Graylog Down** - Triggers when Graylog (`qm-logs.quantus.cat`) is unreachable for 3+ minutes
- 🟡 **Graylog Journal High** - Triggers when the Graylog journal exceeds 65% for 5+ minutes
- 🟡 **Graylog Indexer Failures** - Triggers when OpenSearch write/flush failures are above 0 for 5+ minutes
- 🟡 **Graylog Heap High** - Triggers when Graylog JVM heap exceeds 85% for 10+ minutes

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
  # Omit notification_settings so production/local notification policies choose the receiver
```

**Alert Notification Policies:**

Policies are assembled at container start from `policies.production.yml` or `policies.local.yml` (see Alert Routing above). Production priorities:

| Network | Priority | First Notification | Repeat Interval |
|---------|----------|-------------------|-----------------|
| **Planck** 🔴 | Highest | 2 minutes | once until resolved (`8736h`) |
| **staging_mainnet** 🔴 | Highest | 2 minutes | once until resolved (`8736h`) |
| **Heisenberg** 🟡 | Medium | 10 minutes | once until resolved (`8736h`) |

Fallback by severity (if no chain label):
- **Critical alerts** (severity=critical): 10s wait, once until resolved
- **Warning alerts** (severity=warning): 30s wait → Slack, once until resolved

After changing alert configuration (rules, contact points, or policies under `grafana/provisioning/alerting/`), rebuild and recreate Grafana so the image picks up the files:
```bash
docker compose up -d --build grafana
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
├── logo.svg        # Sidebar logo (SVG → grafana_icon.svg)
├── logo.png        # Apple touch icon (180×180)
├── favicon.ico     # Browser tab icon
├── fav32.png       # 32×32 PNG for Grafana’s fav32 slot
├── quantus_login_dark.svg   # Login background (dark theme)
├── quantus_login_light.svg  # Login background (light theme)
└── quantus-favicon.svg      # Optional source for regenerating raster icons
```

To customize:
1. Replace files in `grafana/branding/` with your own
2. Rebuild the Grafana image (assets are baked in at build time): `docker compose up -d --build grafana`
3. Hard refresh the browser (Ctrl+Shift+R / Cmd+Shift+R)

Branding is applied in `grafana/Dockerfile` via `COPY` into `/usr/share/grafana/public/img/` (same idea as commit `53a13823`). For the login background, `docker-compose.yml` also bind-mounts `quantus_login_*.svg` onto `g8_login_*.svg`.

#### Cloudflare (or any CDN) in front of Grafana

Grafana serves `/public/img/*.svg` with long browser cache headers (`Cache-Control: public, max-age=14400` and similar). **Cloudflare will cache those responses** (`cf-cache-status: HIT`). After you change login artwork or icons on the origin, visitors can still see the **old** `g8_login_dark.svg` until the edge cache expires or you **purge cache** for those URLs (or add a Cache Rule to bypass or shorten TTL for `/public/img/*`).

## Project Structure

```
monitoring/
├── docker-compose.yml              # Main configuration (+ slack-report profile)
├── slack-report/                   # Daily Slack dashboard reports (opt-in profile)
│   ├── Dockerfile                  # Alpine + supercronic report runner
│   ├── docker-entrypoint.sh        # Cron from SLACK_REPORT_CRON
│   └── slack-report.sh             # Render dashboards → Slack
├── scripts/
│   └── reorganize_dashboards.py    # One-off dashboard maintenance helper
├── prometheus/
│   └── prometheus.yml              # Prometheus scrape configs
├── nginx/
│   ├── nginx.conf                  # Nginx reverse proxy config
│   ├── Dockerfile                  # Custom nginx image with htpasswd
│   └── docker-entrypoint.sh        # Auth generation script
├── grafana/
│   ├── dashboards/                 # Pre-loaded dashboards (by concern)
│   │   ├── overview/               # Home / multi-chain summary
│   │   ├── chains/                 # Chain dashboards (chain selector)
│   │   ├── infrastructure/         # Hosts & telemetry
│   │   └── applications/           # Faucet, explorer, graylog
│   ├── branding/                   # Quantus branding assets
│   │   ├── logo.svg                # Sidebar logo (SVG)
│   │   ├── logo.png                # Apple touch icon
│   │   ├── favicon.ico             # Favicon
│   │   └── fav32.png               # 32×32 favicon PNG
│   └── provisioning/               # Auto-configuration
│       ├── datasources/            # Prometheus datasource
│       ├── dashboards/             # Dashboard providers
│       └── alerting/               # Alert templates (assembled at container start)
│           ├── rules.yml           # Alert rules
│           ├── contactpoints.base.yml
│           ├── contactpoints.telegram.fragment.yml
│           ├── contactpoints.slack.fragment.yml
│           ├── policies.local.yml      # Email-only (local/testing)
│           └── policies.production.yml # Email / Telegram / Slack routing
├── .env.example                    # Environment variables template
├── .gitignore
└── README.md
```

`docker compose --profile slack-report` also starts **grafana-renderer** (`grafana/grafana-image-renderer`) and **slack-report** (daily cron).

## Included Dashboards

Dashboards are grouped by **concern**, not by network. Chain-specific views use a **Chain** dropdown (planck / heisenberg / staging bootnode / staging rpcnode).

### Overview (home)

**Quantus Network Overview** — first page after login:
- Chain height, last block age, and uptime for Planck, Heisenberg, staging bootnodes, and staging RPC nodes
- Telemetry host status and connected nodes
- Refreshes every 10 seconds

**Service Status** — public-safe status for chains and support services (intended for Grafana Public Dashboard sharing):
- Chains: Planck / Heisenberg (Chain 1–2 + Node 1–2 each); Staging Bootnodes (`a1`–`a7` chain + host, fleet 30d); Staging RPC nodes (`rpc1`/`rpc2` chain + host, fleet 30d)
- Quersi; Logs (Host / Graylog); Senoti units (App / DB / MQ / Watcher / Core); Explorer (Planck) and Staging Explorer units (Indexer / API 1–2 / DB / Chain + sync); Faucet; Telemetry
- Explorer DB uses `max(up)` across blue/green (only one active outside cutover; matches alerts)
- Per-unit UP/DOWN, 30d availability %, and coarse success/error rates only — no host capacity, balances, or internal topology

### Chains

All chain dashboards share a chain selector and link to each other via the **Chains** dropdown:

| Dashboard | What it covers |
|-----------|----------------|
| **Chain Health** | Height, block age, peers, syncing, difficulty, uptime |
| **Consensus & Mining** | Hashrate, difficulty, block time, mining duration (QPoW) |
| **Node Operations** | CPU/memory, block pipeline, trie cache, runtime performance |
| **Network & Peers** | P2P connections, bandwidth, Kademlia, sync peers |
| **Transactions** | TXPool activity and RPC sessions |

### Infrastructure

| Dashboard | What it covers |
|-----------|----------------|
| **Monitoring Stack** | Docker host running Prometheus/Grafana |
| **Telemetry** | Telemetry VPS host + backend message feeds |
| **Support Host** | Support server system metrics |
| **Senoti Host** | Senoti fleet system metrics |
| **Subsquid Host** | Subsquid fleet system metrics (Fleet: Planck / staging) |
| **Quersi Host** | Quersi wallet remote-config system metrics |
| **Logs Host** | Logs server system metrics |

### Applications

| Dashboard | What it covers |
|-----------|----------------|
| **Faucet** | Request rates, transfers, balance, rejections |
| **Explorer** | Subsquid sync, RPC, Node.js performance (Fleet: Planck / staging) |
| **Graylog** | Ingest rate, journal fill, buffer fill, indexer failures, heap |

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
1. ✅ **Grafana login required** - Anonymous access is disabled; dashboards, Explore, and alerting need credentials
2. ✅ **Prometheus Basic Auth** - Already configured (change credentials in `.env`)
3. ✅ **Rate Limiting** - 30 req/sec, prevents bruteforce attacks
4. ⚠️ **Strong Credentials** - The compose defaults (`admin`/`admin` for Grafana, `prometheus` and `grafana` fallbacks) are for local dev only. Override them in `.env` before any production/internet-exposed deploy:
   ```bash
   GRAFANA_ADMIN_PASSWORD=$(openssl rand -base64 32)
   POSTGRES_PASSWORD=$(openssl rand -base64 32)
   PROMETHEUS_USER=monitoring_$(openssl rand -hex 8)
   PROMETHEUS_PASSWORD=$(openssl rand -base64 32)
   ```
5. ⚠️ **SSL/TLS** - Use Cloudflare Tunnel or reverse proxy (Caddy, Traefik)
6. ⚠️ **Firewall** - Restrict ports or use VPN

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
