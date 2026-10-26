import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const prometheusYml = readFileSync(join(root, "prometheus/prometheus.yml"), "utf8");
const rulesYml = readFileSync(join(root, "grafana/provisioning/alerting/rules.yml"), "utf8");
const status = JSON.parse(
  readFileSync(join(root, "grafana/dashboards/overview/service-status.json"), "utf8"),
);

const removedAlertUids = ["faucet_downtime", "faucet_high_failure_rate", "faucet_high_rejection_rate"];

assert.doesNotMatch(prometheusYml, /job_name:\s*'?support-faucet'?/);
assert.doesNotMatch(prometheusYml, /fm-support\.quantus\.cat/);
assert.match(prometheusYml, /job_name:\s*'support-host'/);

assert.doesNotMatch(rulesYml, /support-faucet/);
assert.doesNotMatch(rulesYml, /title: Faucet /);
for (const uid of removedAlertUids) {
  assert.match(rulesYml, new RegExp(`deleteRules:[\\s\\S]*uid: ${uid}`));
  assert.doesNotMatch(rulesYml, new RegExp(`uid: ${uid}\\n\\s+title:`));
}

assert.equal(existsSync(join(root, "grafana/dashboards/applications/faucet.json")), false);

const faucetPanels = status.panels.filter((panel) => {
  const title = panel.title ?? "";
  const content = panel.options?.content ?? "";
  const exprs = (panel.targets ?? []).map((target) => target.expr ?? "").join("\n");
  return /faucet/i.test(`${title}\n${content}\n${exprs}`);
});
assert.deepEqual(
  faucetPanels.map((panel) => panel.title ?? panel.options?.content),
  [],
);

const telemetry = status.panels.find((panel) => panel.options?.content === "## Telemetry");
assert.equal(telemetry.gridPos.y, 99);
const telemetryStats = status.panels.filter((panel) => panel.gridPos.y === telemetry.gridPos.y + 2);
assert.equal(telemetryStats.length, 4);
assert.equal(
  telemetryStats.reduce((sum, panel) => sum + panel.gridPos.w, 0),
  24,
);
