# Quantus Chain - Monitoring Stack

Complete monitoring solution for Quantus blockchain nodes using Prometheus + Grafana.

## 📦 What's Included

- **Prometheus**: Metrics collection and storage
- **Grafana**: Visualization and dashboards
- **Node Exporter**: System-level metrics (CPU, RAM, Disk, Network)
- **Pre-configured Dashboard**: Substrate-specific metrics

## 🚀 Quick Start

### 1. Prerequisites

- Docker and Docker Compose installed
- Quantus node running with metrics enabled (port 9615)

### 2. Start Monitoring Stack

```bash
cd monitoring
docker-compose up -d
```

### 3. Access Services

- **Grafana**: http://localhost:3000
  - Username: `admin`
  - Password: `admin` (change on first login)
  
- **Prometheus**: http://localhost:9090

### 4. Verify Metrics Collection

Open Prometheus at http://localhost:9090 and check if targets are UP:
- Go to Status → Targets
- All targets should show "UP" status

## 📊 Dashboards

### Quantus Substrate Node Overview

Pre-configured dashboard showing:
- **Block Height**: Best and finalized blocks
- **Peer Count**: Number of connected peers
- **Memory Usage**: Node memory consumption
- **CPU Usage**: Node CPU utilization
- **Network Traffic**: Inbound/outbound network traffic
- **Task Execution**: Internal task performance

Access: Grafana → Dashboards → Quantus Chain → Substrate Node Overview

## ⚙️ Configuration

### Monitoring Your Local Node

If your Quantus node is running locally:

1. Make sure node is started with `--prometheus-external` flag:
```bash
./target/debug/quantus-node --dev --prometheus-external
```

2. The default config in `prometheus.yml` already targets `host.docker.internal:9615`

### Monitoring Remote Nodes

Edit `prometheus.yml` and add your nodes:

```yaml
scrape_configs:
  - job_name: 'quantus-heisenberg'
    static_configs:
      - targets: ['192.168.1.100:9615', '192.168.1.101:9615']
        labels:
          chain: 'heisenberg'
          network: 'testnet'
```

Then restart Prometheus:
```bash
docker-compose restart prometheus
```

### Adjusting Retention

Edit `docker-compose.yml` and modify Prometheus command:

```yaml
- '--storage.tsdb.retention.time=30d'  # Keep data for 30 days
- '--storage.tsdb.retention.size=10GB' # Max 10GB storage
```

## 📈 Key Substrate Metrics

The following metrics are available from Substrate nodes:

| Metric | Description |
|--------|-------------|
| `substrate_block_height{status="best"}` | Current best block number |
| `substrate_block_height{status="finalized"}` | Current finalized block |
| `substrate_sub_libp2p_peers_count` | Number of connected peers |
| `substrate_sub_libp2p_network_bytes_total` | Network traffic |
| `substrate_tasks_polling_duration_*` | Task execution times |
| `process_resident_memory_bytes` | Node memory usage |
| `process_cpu_seconds_total` | Node CPU usage |

## 🔧 Useful Commands

### View logs
```bash
docker-compose logs -f prometheus
docker-compose logs -f grafana
```

### Restart services
```bash
docker-compose restart
```

### Stop monitoring
```bash
docker-compose down
```

### Stop and remove all data
```bash
docker-compose down -v
```

### Update to latest images
```bash
docker-compose pull
docker-compose up -d
```

## 📝 Next Steps

### For Production Deployment

1. **Change Grafana password** (default: admin/admin)
2. **Enable authentication** in Prometheus
3. **Set up alerts** (add Alertmanager)
4. **Configure backup** for Grafana dashboards
5. **Use persistent volumes** with proper backup
6. **Set up HTTPS** with reverse proxy (nginx/traefik)

### Adding Alerts

Create `monitoring/alerts/node-alerts.yml`:

```yaml
groups:
  - name: quantus_node
    interval: 30s
    rules:
      - alert: NodeDown
        expr: up{job="quantus-node"} == 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Quantus node is down"
          
      - alert: LowPeerCount
        expr: substrate_sub_libp2p_peers_count < 3
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Low peer count: {{ $value }}"
```

### Grafana Dashboards

Additional recommended dashboards:
- **Substrate Networking**: https://grafana.com/grafana/dashboards/13840
- **Node Exporter Full**: https://grafana.com/grafana/dashboards/1860

Import in Grafana: Dashboard → Import → Enter ID

## 🐛 Troubleshooting

### Prometheus can't reach node

**Problem**: Target shows "DOWN" in Prometheus

**Solution**: Check if node is running with metrics enabled:
```bash
curl http://localhost:9615/metrics
```

If this doesn't work, restart node with `--prometheus-external` flag.

### No data in Grafana

1. Check Prometheus is scraping: http://localhost:9090/targets
2. Verify datasource in Grafana: Configuration → Data Sources
3. Check Prometheus query in dashboard panels

### Permission errors on Linux

```bash
sudo chown -R $USER:$USER prometheus-data grafana-data
```

### SELinux issues (Fedora/RHEL)

Add `:Z` flag to docker-compose volumes:
```yaml
volumes:
  - ./prometheus-data:/prometheus:Z
```

## 📚 Resources

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Substrate Metrics](https://docs.substrate.io/maintain/monitor/)
- [Quantus Chain Docs](../README.md)

## 🔐 Security Notes

⚠️ **This configuration is for LOCAL/DEV use only!**

For production:
- Change default passwords
- Enable authentication on Prometheus
- Use TLS/HTTPS
- Restrict network access (firewall rules)
- Don't expose ports publicly without authentication
- Consider using separate Prometheus instances per environment

---

**Environment Recommendations:**

- **Heisenberg (Internal)**: Separate Prometheus, short retention (15d)
- **Schrodinger (Public Testnet)**: Separate Prometheus, medium retention (30d)
- **Mainnet**: Separate Prometheus with HA, long retention (90d+), alerting

