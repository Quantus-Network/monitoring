import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));

function readRepo(path) {
  return readFileSync(join(root, path), "utf8");
}

const bakedHostMounts = [
  "./prometheus/prometheus.yml:",
  "./grafana/provisioning/",
  "./grafana/dashboards:",
  "./grafana/branding",
  "./grafana/grafana.ini:",
  "g8_login_",
];

test("compose does not bind-mount files that ship inside images", () => {
  const compose = readRepo("docker-compose.yml");
  for (const mount of bakedHostMounts) {
    assert.equal(compose.includes(mount), false, `compose still bind-mounts ${mount}`);
  }
  assert.doesNotMatch(compose, /CF_ACCESS_CLIENT_ID" > \/etc\/prometheus\/secrets/);
});

test("custom services pull a shared GHCR tag and still build locally", () => {
  const compose = readRepo("docker-compose.yml");
  for (const name of [
    "monitoring-prometheus",
    "monitoring-nginx",
    "monitoring-grafana",
    "monitoring-slack-report",
  ]) {
    assert.match(
      compose,
      new RegExp(
        `image: ghcr\\.io/quantus-network/${name}:\\$\\{MONITORING_TAG:-local\\}`,
      ),
    );
  }
  assert.match(compose, /context: \.\/prometheus/);
  assert.match(compose, /context: \.\/grafana/);
  assert.match(compose, /context: \.\/nginx/);
  assert.match(compose, /context: \.\/slack-report/);
});

test("grafana home dashboard path is outside the data volume", () => {
  const compose = readRepo("docker-compose.yml");
  assert.match(
    compose,
    /GF_DASHBOARDS_DEFAULT_HOME_DASHBOARD_PATH=\/usr\/share\/grafana\/dashboards\/overview\/welcome\.json/,
  );
});

test("dashboard providers read baked paths under /usr/share/grafana/dashboards", () => {
  const dashboardYml = readRepo("grafana/provisioning/dashboards/dashboard.yml");
  assert.doesNotMatch(dashboardYml, /\/var\/lib\/grafana\/dashboards/);
  for (const folder of ["overview", "chains", "infrastructure", "applications"]) {
    assert.match(dashboardYml, new RegExp(`/usr/share/grafana/dashboards/${folder}`));
  }
});

test("grafana image copies dashboards, provisioning, and grafana.ini", () => {
  const grafanaDockerfile = readRepo("grafana/Dockerfile");
  assert.match(grafanaDockerfile, /COPY provisioning\/datasources \/etc\/grafana\/provisioning\/datasources/);
  assert.match(grafanaDockerfile, /COPY provisioning\/dashboards \/etc\/grafana\/provisioning\/dashboards/);
  assert.match(grafanaDockerfile, /COPY dashboards \/usr\/share\/grafana\/dashboards/);
  assert.match(grafanaDockerfile, /COPY grafana\.ini \/etc\/grafana\/grafana\.ini/);
});

test("prometheus image pins a Prometheus 3 release and copies its config", () => {
  const prometheusDockerfile = readRepo("prometheus/Dockerfile");
  assert.match(prometheusDockerfile, /FROM prom\/prometheus:v3\.\d+\.\d+/);
  assert.doesNotMatch(prometheusDockerfile, /prom\/prometheus:latest/);
  assert.match(prometheusDockerfile, /COPY prometheus\.yml \/etc\/prometheus\/prometheus\.yml/);
  assert.match(prometheusDockerfile, /COPY docker-entrypoint\.sh /);
});
