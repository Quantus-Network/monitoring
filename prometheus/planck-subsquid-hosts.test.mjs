import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const prometheusYml = readFileSync(join(root, "prometheus/prometheus.yml"), "utf8");
const rulesYml = readFileSync(join(root, "grafana/provisioning/alerting/rules.yml"), "utf8");
const status = JSON.parse(
  readFileSync(join(root, "grafana/dashboards/overview/service-status.json"), "utf8"),
);
const host = JSON.parse(
  readFileSync(join(root, "grafana/dashboards/infrastructure/subsquid-host.json"), "utf8"),
);

const jobBlocks = prometheusYml.split(/(?=- job_name: )/).filter((block) => block.startsWith("- job_name:"));

function jobBlock(name) {
  return jobBlocks.find((block) => block.startsWith(`- job_name: ${name}\n`));
}

for (const name of ["planck-subsquid-app-2", "planck-subsquid-chain-1"]) {
  assert.equal(jobBlock(name), undefined, `${name} scrape job must be removed`);
}

assert.match(jobBlock("planck-subsquid-app-1"), /subsquid-app-1\.quantus\.com/);
assert.match(jobBlock("mainnet-subsquid-app-2"), /subsquid-mainnet-app-2\.quantus\.com/);
assert.match(jobBlock("mainnet-subsquid-chain-1"), /subsquid-mainnet-chain-1\.quantus\.com/);
assert.doesNotMatch(prometheusYml, /subsquid-app-2\.quantus\.com/);
assert.doesNotMatch(prometheusYml, /(?<!mainnet-)subsquid-chain-1\.quantus\.com/);

function exprs(panels) {
  const found = [];
  for (const panel of panels) {
    for (const target of panel.targets ?? []) {
      if (target.expr) found.push(target.expr);
    }
  }
  return found;
}

const statusExprs = exprs(status.panels);
assert.equal(statusExprs.some((expr) => expr.includes("planck-subsquid-app-2")), false);
assert.equal(statusExprs.some((expr) => expr.includes("planck-subsquid-chain-1")), false);
assert.equal(statusExprs.some((expr) => expr.includes("planck-subsquid-app-1")), true);
assert.equal(statusExprs.some((expr) => expr.includes("mainnet-subsquid-app-2")), true);
assert.equal(statusExprs.some((expr) => expr.includes("mainnet-subsquid-chain-1")), true);

const planckUp = status.panels.filter(
  (panel) => panel.type === "stat" && panel.targets?.[0]?.expr === 'up{job="planck-subsquid-proc-1"}'
    || panel.targets?.[0]?.expr === 'up{job="planck-subsquid-app-1"}'
    || panel.targets?.[0]?.expr === 'max(up{job=~"planck-subsquid-db-(blue|green)-1"})',
);
assert.equal(planckUp.length, 3);
assert.equal(planckUp.reduce((sum, panel) => sum + panel.gridPos.w, 0), 24);

const planckAlert = rulesYml.slice(
  rulesYml.indexOf("uid: planck_subsquid_app_chain_down"),
  rulesYml.indexOf("uid: planck_subsquid_db_both_down"),
);
assert.match(planckAlert, /title: Planck Subsquid App Down/);
assert.match(planckAlert, /expr: up\{job="planck-subsquid-app-1"\}/);
assert.doesNotMatch(planckAlert, /planck-subsquid-\(app\|chain\)/);
assert.match(rulesYml, /expr: up\{job=~"mainnet-subsquid-\(app\|chain\)\.\*"\}/);

const tile = host.templating.list.find((item) => item.name === "tile");
assert.equal(tile.hide, 2);
assert.match(tile.definition, /label_values\(up\{job=~"\$\{fleet\}-subsquid-\(proc-1-hm\|app-1\|app-2\|db-blue-1\|db-green-1\|chain-1\)"\}, job\)/);
const repeated = host.panels.find((panel) => panel.repeat === "tile");
assert.equal(repeated.targets[0].expr, 'up{job="${fleet}-subsquid-$tile"}');
assert.equal(host.panels.some((panel) => panel.title === "app-2" || panel.title === "chain-1"), false);

const hostVar = host.templating.list.find((item) => item.name === "job");
assert.equal(hostVar.type, "query");
assert.match(hostVar.definition, /app-2\|db-blue-1\|db-green-1\|chain-1/);
assert.equal(
  host.panels.some((panel) =>
    (panel.targets ?? []).some((target) => String(target.expr).includes('job=~"$job"')),
  ),
  false,
);
