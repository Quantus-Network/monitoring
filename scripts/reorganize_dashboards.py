#!/usr/bin/env python3
"""Reorganize Grafana dashboards into concern-based folders with chain variables."""

from __future__ import annotations

import copy
import json
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DASHBOARDS = ROOT / "grafana" / "dashboards"
CHAINS = ("planck", "heisenberg", "dirac")

CONSENSUS_TITLES = {
    "Estimated Network Hashrate",
    "Avg Network Hashrate (range)",
    "Last Block Mining Time",
    "Chain Height",
    "Block Time",
    "Difficulty",
}

NODE_OPS_TITLES = {
    "Block Construction Time",
    "Transactions per Block",
    "Major Syncing",
    "Chain Leaves (Forks)",
    "Chain Leaves Over Time",
    "Block Verification & Import Time",
}


def load(path: Path) -> dict:
    with path.open() as f:
        return json.load(f)


def save(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w") as f:
        json.dump(data, f, indent=2)
        f.write("\n")


def substitute_chain(text: str) -> str:
    if not isinstance(text, str):
        return text
    for chain in CHAINS:
        text = text.replace(f'chain="{chain}"', 'chain="$chain"')
        text = text.replace(f"chain='{chain}'", "chain='$chain'")
        text = text.replace(f'job="{chain}-node"', 'job="${chain}-node"')
        text = text.replace(f'job="{chain}-chain"', 'job="${chain}-chain"')
        text = text.replace(f'job=~".*-{chain}"', 'job=~"${chain}-.*"')
    # welcome uptime pattern
    text = re.sub(
        r'up\{job="([a-z]+)-chain"',
        r'up{job="${chain}-chain"',
        text,
    )
    return text


def walk_substitute(obj):
    if isinstance(obj, dict):
        return {k: walk_substitute(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [walk_substitute(v) for v in obj]
    if isinstance(obj, str):
        return substitute_chain(obj)
    return obj


def panels_by_title(dashboard: dict, titles: set[str]) -> list[dict]:
    return [p for p in dashboard.get("panels", []) if p.get("title") in titles]


def flatten_panels(panels: list[dict]) -> list[dict]:
    flat: list[dict] = []
    for panel in panels:
        if panel.get("type") == "row" and panel.get("panels"):
            flat.extend(panel["panels"])
        else:
            flat.append(panel)
    return flat


def renumber_panels(panels: list[dict], start_id: int = 1) -> list[dict]:
    out = []
    next_id = start_id
    for panel in panels:
        p = copy.deepcopy(panel)
        if p.get("type") == "row":
            p["id"] = next_id
            next_id += 1
            if p.get("panels"):
                p["panels"], next_id = renumber_panels(p["panels"], next_id)
            out.append(p)
            continue
        p["id"] = next_id
        next_id += 1
        out.append(p)
    return out


def stack_panels(panels: list[dict]) -> list[dict]:
    """Reflow panels vertically; preserve row groupings."""
    current_y = 0
    stacked = []
    for panel in panels:
        p = copy.deepcopy(panel)
        if p.get("type") == "row":
            p["gridPos"] = {"h": 1, "w": 24, "x": 0, "y": current_y}
            current_y += 1
            if p.get("panels"):
                row_panels = []
                row_y = current_y
                for child in p["panels"]:
                    c = copy.deepcopy(child)
                    c["gridPos"] = {
                        "h": c.get("gridPos", {}).get("h", 8),
                        "w": c.get("gridPos", {}).get("w", 12),
                        "x": c.get("gridPos", {}).get("x", 0),
                        "y": row_y,
                    }
                    row_y += c["gridPos"]["h"]
                    row_panels.append(c)
                p["panels"] = row_panels
                current_y = row_y
            stacked.append(p)
            continue

        h = p.get("gridPos", {}).get("h", 8)
        w = p.get("gridPos", {}).get("w", 12)
        x = p.get("gridPos", {}).get("x", 0)
        p["gridPos"] = {"h": h, "w": w, "x": x, "y": current_y}
        current_y += h
        stacked.append(p)
    return stacked


def chain_variable(include_datasource: bool = False) -> list[dict]:
    variables = [
        {
            "current": {"selected": True, "text": "planck", "value": "planck"},
            "hide": 0,
            "includeAll": False,
            "label": "Chain",
            "multi": False,
            "name": "chain",
            "options": [
                {"selected": True, "text": "planck", "value": "planck"},
                {"selected": False, "text": "heisenberg", "value": "heisenberg"},
                {"selected": False, "text": "dirac", "value": "dirac"},
            ],
            "query": "planck,heisenberg,dirac",
            "skipUrlSync": False,
            "type": "custom",
        }
    ]
    if include_datasource:
        variables.insert(
            0,
            {
                "current": {"selected": False, "text": "Prometheus", "value": "Prometheus"},
                "hide": 2,
                "includeAll": False,
                "label": "Datasource",
                "multi": False,
                "name": "DS_PROMETHEUS",
                "options": [],
                "query": "prometheus",
                "refresh": 1,
                "regex": "",
                "skipUrlSync": False,
                "type": "datasource",
            },
        )
    return variables


def make_dashboard(
    *,
    title: str,
    uid: str,
    tags: list[str],
    panels: list[dict],
    refresh: str = "10s",
    time_from: str = "now-1h",
    include_datasource_var: bool = False,
    links: list[dict] | None = None,
) -> dict:
    panels = stack_panels(renumber_panels(panels))
    return {
        "annotations": {"list": []},
        "editable": True,
        "fiscalYearStartMonth": 0,
        "graphTooltip": 0,
        "links": links or [],
        "panels": walk_substitute(panels),
        "refresh": refresh,
        "schemaVersion": 38,
        "style": "dark",
        "tags": tags,
        "templating": {"list": chain_variable(include_datasource_var)},
        "time": {"from": time_from, "to": "now"},
        "timepicker": {},
        "timezone": "browser",
        "title": title,
        "uid": uid,
        "version": 1,
    }


def stat_panel(
    panel_id: int,
    title: str,
    expr: str,
    grid: dict,
    *,
    unit: str = "none",
    decimals: int = 0,
    color_mode: str = "value",
    mappings: list | None = None,
    thresholds: list | None = None,
) -> dict:
    defaults: dict = {
        "unit": unit,
        "decimals": decimals,
        "color": {"mode": "thresholds" if thresholds else "palette-classic"},
    }
    if thresholds:
        defaults["thresholds"] = {"mode": "absolute", "steps": thresholds}
    if mappings:
        defaults["mappings"] = mappings

    return {
        "type": "stat",
        "title": title,
        "id": panel_id,
        "gridPos": grid,
        "datasource": {"type": "prometheus", "uid": "prometheus"},
        "targets": [
            {
                "expr": expr,
                "refId": "A",
                "datasource": {"type": "prometheus", "uid": "prometheus"},
            }
        ],
        "options": {
            "reduceOptions": {"values": False, "calcs": ["lastNotNull"], "fields": ""},
            "colorMode": color_mode,
            "graphMode": "none",
            "justifyMode": "auto",
            "orientation": "auto",
            "textMode": "auto",
        },
        "fieldConfig": {"defaults": defaults, "overrides": []},
    }


def build_chain_health() -> dict:
    panels = [
        stat_panel(
            1,
            "Chain Height",
            'max(qpow_metrics{data_group="chain_height", chain="$chain"})',
            {"h": 5, "w": 4, "x": 0, "y": 0},
            decimals=0,
        ),
        stat_panel(
            2,
            "Last Block Age",
            'time() - (max(qpow_metrics{data_group="last_block_time", chain="$chain"}) / 1000)',
            {"h": 5, "w": 4, "x": 4, "y": 0},
            unit="s",
            decimals=0,
            color_mode="background",
            thresholds=[
                {"color": "green", "value": None},
                {"color": "yellow", "value": 180},
                {"color": "red", "value": 600},
            ],
        ),
        stat_panel(
            3,
            "Connected Peers",
            'max(substrate_sub_libp2p_peers_count{chain="$chain"})',
            {"h": 5, "w": 4, "x": 8, "y": 0},
            decimals=0,
        ),
        stat_panel(
            4,
            "Major Syncing",
            'max(substrate_sub_libp2p_is_major_syncing{chain="$chain"})',
            {"h": 5, "w": 4, "x": 12, "y": 0},
            mappings=[
                {
                    "type": "value",
                    "options": {
                        "0": {"color": "green", "text": "No"},
                        "1": {"color": "red", "text": "YES"},
                    },
                }
            ],
            color_mode="background",
            thresholds=[
                {"color": "green", "value": None},
                {"color": "red", "value": 1},
            ],
        ),
        stat_panel(
            5,
            "Difficulty",
            'max(qpow_metrics{data_group="difficulty", chain="$chain"})',
            {"h": 5, "w": 4, "x": 16, "y": 0},
            decimals=0,
        ),
        stat_panel(
            6,
            "Node Uptime (30d)",
            'avg_over_time(up{job="${chain}-chain", instance=~"a1.*"}[30d]) * 100',
            {"h": 5, "w": 4, "x": 20, "y": 0},
            unit="percent",
            decimals=1,
            color_mode="background",
            thresholds=[
                {"color": "red", "value": None},
                {"color": "yellow", "value": 50},
                {"color": "green", "value": 90},
            ],
        ),
    ]

    # Trend panels borrowed from overview
    overview = load(DASHBOARDS / "planck" / "planck-overview.json")
    for title in ("Block Height", "Connected Peers"):
        for p in overview["panels"]:
            if p.get("title") == title:
                p = copy.deepcopy(p)
                p["gridPos"]["y"] = 5
                panels.append(p)

    return make_dashboard(
        title="Chain Health",
        uid="chain-health",
        tags=["chains", "health"],
        panels=panels,
        links=_chain_links("chain-health"),
    )


def _chain_links(current_uid: str) -> list[dict]:
    dashboards = [
        ("Chain Health", "chain-health"),
        ("Consensus & Mining", "chain-consensus-mining"),
        ("Node Operations", "chain-node-operations"),
        ("Network & Peers", "chain-network-peers"),
        ("Transactions", "chain-transactions"),
    ]
    return [
        {
            "asDropdown": True,
            "icon": "external link",
            "includeVars": True,
            "keepTime": True,
            "tags": [],
            "targetBlank": False,
            "title": "Chains",
            "type": "dashboards",
            "url": "",
        }
    ]


def build_consensus() -> dict:
    business = load(DASHBOARDS / "planck" / "planck-business.json")
    panels = panels_by_title(business, CONSENSUS_TITLES)
    return make_dashboard(
        title="Consensus & Mining",
        uid="chain-consensus-mining",
        tags=["chains", "consensus", "qpow"],
        panels=panels,
        links=_chain_links("chain-consensus-mining"),
    )


def build_node_operations() -> dict:
    business = load(DASHBOARDS / "planck" / "planck-business.json")
    overview = load(DASHBOARDS / "planck" / "planck-overview.json")
    performance = load(DASHBOARDS / "planck" / "planck-performance.json")

    panels: list[dict] = []
    panels.extend(copy.deepcopy(overview["panels"]))
    panels.extend(panels_by_title(business, NODE_OPS_TITLES))
    panels.extend(copy.deepcopy(performance["panels"]))
    return make_dashboard(
        title="Node Operations",
        uid="chain-node-operations",
        tags=["chains", "node", "substrate"],
        panels=panels,
        links=_chain_links("chain-node-operations"),
    )


def build_network_peers() -> dict:
    peers = load(DASHBOARDS / "planck" / "planck-peers.json")
    return make_dashboard(
        title="Network & Peers",
        uid="chain-network-peers",
        tags=["chains", "network", "peers"],
        panels=copy.deepcopy(peers["panels"]),
        refresh="5s",
        time_from="now-3h",
        include_datasource_var=True,
        links=_chain_links("chain-network-peers"),
    )


def build_transactions() -> dict:
    tx = load(DASHBOARDS / "planck" / "planck-transactions.json")
    rpc = load(DASHBOARDS / "planck" / "planck-rpc.json")
    panels = copy.deepcopy(tx["panels"]) + copy.deepcopy(rpc["panels"])
    return make_dashboard(
        title="Transactions",
        uid="chain-transactions",
        tags=["chains", "transactions", "txpool", "rpc"],
        panels=panels,
        time_from="now-6h",
        links=_chain_links("chain-transactions"),
    )


def move_infrastructure_and_apps() -> None:
    moves = {
        DASHBOARDS / "system" / "localhost-monitoring.json": (
            DASHBOARDS / "infrastructure" / "monitoring-stack.json",
            "Monitoring Stack",
            "infra-monitoring-stack",
            ["infrastructure", "monitoring"],
        ),
        DASHBOARDS / "system" / "telemetry-monitoring.json": (
            DASHBOARDS / "infrastructure" / "telemetry.json",
            "Telemetry",
            "infra-telemetry",
            ["infrastructure", "telemetry"],
        ),
        DASHBOARDS / "system" / "support-monitoring.json": (
            DASHBOARDS / "infrastructure" / "support-host.json",
            "Support Host",
            "infra-support-host",
            ["infrastructure", "support"],
        ),
        DASHBOARDS / "system" / "snt-monitoring.json": (
            DASHBOARDS / "infrastructure" / "snt-host.json",
            "SNT Host",
            "infra-snt-host",
            ["infrastructure", "snt"],
        ),
        DASHBOARDS / "system" / "faucet-monitoring.json": (
            DASHBOARDS / "applications" / "faucet.json",
            "Faucet",
            "app-faucet",
            ["applications", "faucet"],
        ),
        DASHBOARDS / "system" / "explorer-monitoring.json": (
            DASHBOARDS / "applications" / "explorer.json",
            "Explorer",
            "app-explorer",
            ["applications", "explorer"],
        ),
        DASHBOARDS / "system" / "quests-monitoring.json": (
            DASHBOARDS / "applications" / "quests.json",
            "Quests",
            "app-quests",
            ["applications", "quests"],
        ),
    }

    for src, (dest, title, uid, tags) in moves.items():
        data = load(src)
        data["title"] = title
        data["uid"] = uid
        data["tags"] = tags
        save(dest, data)


def update_welcome() -> None:
    welcome = load(DASHBOARDS / "general" / "welcome.json")
    welcome["panels"][0]["options"]["content"] = (
        "# Quantus Network Overview\n\n"
        "Real-time monitoring across **Planck**, **Heisenberg**, and **Dirac**. "
        "Use the **Chains** folder dashboards with the chain selector for detailed views.\n\n"
        "[quantus.com](https://www.quantus.com/)"
    )

    # Add Dirac chain height + last block stats after Heisenberg panels
    planck_height = welcome["panels"][1]
    heisenberg_height = welcome["panels"][2]
    max_id = max(p["id"] for p in welcome["panels"])

    dirac_height = copy.deepcopy(planck_height)
    dirac_height["id"] = max_id + 1
    dirac_height["title"] = "Dirac - Chain Height"
    dirac_height["targets"][0]["expr"] = (
        'max(qpow_metrics{data_group="chain_height", chain="dirac"})'
    )
    dirac_height["gridPos"] = {"h": 4, "w": 8, "x": 0, "y": 3}

    planck_height["gridPos"] = {"h": 4, "w": 8, "x": 0, "y": 7}
    heisenberg_height["gridPos"] = {"h": 4, "w": 8, "x": 8, "y": 7}

    dirac_block = copy.deepcopy(welcome["panels"][3])
    dirac_block["id"] = max_id + 2
    dirac_block["title"] = "Dirac - Last Block"
    dirac_block["targets"][0]["expr"] = (
        'time() - (max(qpow_metrics{data_group="last_block_time", chain="dirac"}) / 1000)'
    )
    dirac_block["gridPos"] = {"h": 4, "w": 8, "x": 16, "y": 3}

    for p in welcome["panels"][3:]:
        if p.get("gridPos", {}).get("y", 0) >= 9:
            p["gridPos"]["y"] += 4

    welcome["panels"][1]["gridPos"] = planck_height["gridPos"]
    welcome["panels"][2]["gridPos"] = heisenberg_height["gridPos"]
    welcome["panels"][3]["gridPos"] = {"h": 4, "w": 8, "x": 8, "y": 3}
    welcome["panels"].insert(2, dirac_height)
    welcome["panels"].insert(4, dirac_block)

    save(DASHBOARDS / "overview" / "welcome.json", welcome)


def remove_old_dirs() -> None:
    for name in ("planck", "heisenberg", "dirac", "general", "system"):
        path = DASHBOARDS / name
        if path.exists():
            shutil.rmtree(path)


def main() -> None:
    save(DASHBOARDS / "chains" / "chain-health.json", build_chain_health())
    save(DASHBOARDS / "chains" / "consensus-mining.json", build_consensus())
    save(DASHBOARDS / "chains" / "node-operations.json", build_node_operations())
    save(DASHBOARDS / "chains" / "network-peers.json", build_network_peers())
    save(DASHBOARDS / "chains" / "transactions.json", build_transactions())
    move_infrastructure_and_apps()
    update_welcome()
    remove_old_dirs()
    print("Dashboard reorganization complete.")


if __name__ == "__main__":
    main()
