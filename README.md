# Substrate/Polkadot Monitoring Stack

Prometheus + Grafana monitoring stack for Substrate-based blockchain nodes. Simple, unified configuration that works out of the box.

## Features

- 📊 **Prometheus** - Metrics collection and storage (60 days retention)
- 📈 **Grafana** - Metrics visualization with pre-configured dashboards
- 🖥️ **Node Exporter** - System metrics (CPU, RAM, Disk, Network)
- 🎯 **Substrate Dashboard** - Pre-configured dashboard for Substrate/Polkadot nodes
- ⚡ **Single Setup** - One configuration, works everywhere

## Quick Start

```bash
# 1. Clone repository
git clone <your-repo-url>
cd monitoring

# 2. (Optional) Set custom Grafana password
cp .env.example .env
nano .env

# 3. Start the stack
docker compose up -d

# 4. Access Grafana
open http://localhost:3000
# Default credentials: admin / admin
```

That's it! 🎉

## Access URLs

- **Grafana**: http://localhost:3000
- **Prometheus**: http://localhost:9090
- **Node Exporter**: http://localhost:9100/metrics

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
curl -X POST http://localhost:9090/-/reload
```

## Configuration

### Environment Variables

Optional - create `.env` from `.env.example`:

```bash
# Grafana admin password
GRAFANA_ADMIN_PASSWORD=admin

# Custom Grafana URL (optional)
# GRAFANA_ROOT_URL=http://localhost:3000
# GRAFANA_DOMAIN=localhost
```

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
├── grafana/
│   ├── dashboards/                 # Pre-loaded dashboards
│   │   └── substrate-node-overview.json
│   └── provisioning/               # Auto-configuration
│       ├── datasources/            # Prometheus datasource
│       └── dashboards/             # Dashboard provider
├── .env.example                    # Environment variables template
├── .gitignore
└── README.md
```

## Included Dashboard

The stack comes with a **Substrate Node Overview** dashboard showing:

- Block height (best & finalized)
- Connected peers
- Memory usage
- CPU usage
- Network traffic
- Task execution times

Perfect for monitoring Substrate/Polkadot validators and full nodes.

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

1. Check target status: http://localhost:9090/targets
2. Verify target is accessible from Prometheus container
3. Check Prometheus logs: `docker compose logs prometheus`

### Grafana shows "No Data"

1. Verify Prometheus datasource: Grafana → Configuration → Data Sources
2. Check if Prometheus is scraping: http://localhost:9090/targets
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

For production:

1. **Set strong password** in `.env`
2. **Configure reverse proxy** (nginx, Caddy, Traefik) with SSL
3. **Restrict network access** using firewall rules
4. **Increase retention** if needed for long-term metrics
5. **Setup backups** for Docker volumes
6. **Monitor the monitoring** - set up alerting for Prometheus/Grafana availability

This stack is production-ready but you need to add your own security layer (reverse proxy, SSL, authentication).

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

[Your License Here]

## Contributing

Issues and pull requests welcome!

## Support

For Substrate/Polkadot metrics documentation:
- [Substrate Metrics](https://docs.substrate.io/reference/command-line-tools/node-template/#metrics)
- [Polkadot Metrics](https://wiki.polkadot.network/docs/maintain-guides-how-to-monitor-your-node)
