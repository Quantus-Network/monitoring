import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return readFileSync(join(root, rel), "utf8");
}

const monitored = [
  "prometheus/prometheus.yml",
  "grafana/provisioning/alerting/rules.yml",
  "grafana/provisioning/alerting/policies.local.yml",
  "grafana/provisioning/alerting/policies.production.yml",
  "grafana/provisioning/alerting/mute_times.yml",
  "README.md",
  "grafana/dashboards/overview/welcome.json",
  "grafana/dashboards/overview/service-status.json",
  "grafana/dashboards/chains/chain-health.json",
  "grafana/dashboards/chains/consensus-mining.json",
  "grafana/dashboards/chains/node-operations.json",
  "grafana/dashboards/chains/network-peers.json",
  "grafana/dashboards/chains/transactions.json",
];

for (const file of monitored) {
  assert.doesNotMatch(read(file), /heisenberg/i, `${file} still mentions Heisenberg`);
}

const jobBlocks = read("prometheus/prometheus.yml")
  .split(/(?=- job_name: )/)
  .filter((block) => block.startsWith("- job_name:"));

function jobBlock(name) {
  return jobBlocks.find((block) => block.startsWith(`- job_name: ${name}\n`));
}

assert.equal(jobBlock("heisenberg-chain"), undefined);
assert.equal(jobBlock("heisenberg-node"), undefined);

const rules = read("grafana/provisioning/alerting/rules.yml");
assert.match(rules, /expr: substrate_sub_libp2p_peers_count\n/);
assert.match(rules, /job!~"\(planck\|bootnode\|rpcnode\)-node"/);

const welcome = JSON.parse(read("grafana/dashboards/overview/welcome.json"));
const planck = welcome.panels.filter((panel) => panel.title?.startsWith("Planck - "));
assert.deepEqual(
  planck.map((panel) => panel.title),
  ["Planck - Chain Height", "Planck - Last Block", "Planck - Uptime"],
);
assert.deepEqual(
  planck.map((panel) => panel.gridPos.y),
  [3, 3, 3],
);
assert.deepEqual(
  planck.map((panel) => panel.gridPos.x),
  [0, 8, 16],
);
const boot = welcome.panels.find((panel) => panel.title === "Mainnet Bootnodes - Chain Height");
assert.equal(boot.gridPos.y, planck[0].gridPos.y + planck[0].gridPos.h);

const status = JSON.parse(read("grafana/dashboards/overview/service-status.json"));
const planckStatus = status.panels.filter(
  (panel) => panel.title?.startsWith("Planck") || panel.options?.content === "### Planck",
);
const planckBottom = Math.max(...planckStatus.map((panel) => panel.gridPos.y + panel.gridPos.h));
const mainnet = status.panels.find((panel) => panel.options?.content === "### Mainnet Bootnodes");
assert.equal(mainnet.gridPos.y, planckBottom);

for (const file of monitored.filter((path) => path.startsWith("grafana/dashboards/chains/"))) {
  const chain = JSON.parse(read(file)).templating.list.find((item) => item.name === "chain");
  assert.equal(
    chain.options.some((option) => option.value === "heisenberg"),
    false,
    file,
  );
  assert.match(chain.query, /planck$/);
  assert.doesNotMatch(chain.query, /heisenberg/);
}

const script = read("scripts/reorganize_dashboards.py");
assert.match(script, /CHAINS = \("planck",\)/);
assert.doesNotMatch(script, /"text": "heisenberg"/);
assert.doesNotMatch(script, /Heisenberg/);
// One-off helper still deletes a legacy dashboards/heisenberg directory if it is present.
assert.match(script, /\("planck", "heisenberg", "dirac", "general", "system"\)/);
