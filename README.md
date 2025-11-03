# Quantus Network - Monitoring Stack

Prometheus + Grafana monitoring stack for Substrate-based blockchain nodes. Simple, unified configuration that works out of the box.

## Features

- 📊 **Prometheus** - Metrics collection and storage (60 days retention)
- 📈 **Grafana** - Metrics visualization with pre-configured dashboards
- 🖥️ **Node Exporter** - System metrics (CPU, RAM, Disk, Network)
- 🔒 **Nginx Reverse Proxy** - Prometheus protected with Basic Auth + Rate Limiting
- 🎯 **Network Dashboards** - Pre-configured dashboards for multiple blockchain networks
- ⚡ **Single Setup** - One configuration, works everywhere

## Quick Start

```bash
# 1. Clone repository
git clone <your-repo-url>
cd monitoring

# 2. (Optional) Customize credentials
cp .env.example .env
nano .env  # Set GRAFANA_ADMIN_PASSWORD and PROMETHEUS_USER/PASSWORD

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

- **Prometheus** - Self-monitoring
- **Node Exporter** - Host system metrics (CPU, RAM, Disk, Network)
- **Local Substrate Node** (optional) - `host.docker.internal:9615`
  - Monitors your local Substrate/Polkadot node if running
  - Will show as "down" if not running - this is OK!

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
```

**Note**: Copy `.env.example` to `.env` and update with your SMTP credentials:
```bash
cp .env.example .env
nano .env  # Edit SMTP settings
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
│   │   ├── schrodinger/
│   │   ├── resonance/
│   │   └── heisenberg/
│   └── provisioning/               # Auto-configuration
│       ├── datasources/            # Prometheus datasource
│       └── dashboards/             # Dashboard providers
├── .env.example                    # Environment variables template
├── .gitignore
└── README.md
```

## Included Dashboards

The stack comes with pre-configured dashboards organized by network:

### Per Network (Schrodinger, Resonance, Heisenberg):
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
