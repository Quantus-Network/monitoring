import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const promoteScript = join(scriptsDir, "should_promote_latest.sh");
const classifyScript = join(scriptsDir, "classify_manifest_probe.sh");

function gitRepo(tags) {
  const dir = mkdtempSync(join(tmpdir(), "monitoring-release-"));
  const git = (args) =>
    execFileSync("git", args, {
      cwd: dir,
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: "release-test",
        GIT_AUTHOR_EMAIL: "release-test@example.com",
        GIT_COMMITTER_NAME: "release-test",
        GIT_COMMITTER_EMAIL: "release-test@example.com",
      },
    });
  git(["init"]);
  writeFileSync(join(dir, "README"), "test\n");
  git(["add", "README"]);
  git(["-c", "commit.gpgsign=false", "commit", "-m", "init"]);
  for (const tag of tags) {
    git(["tag", tag]);
  }
  return dir;
}

function promoteLatest(selected, tags) {
  return execFileSync("bash", [promoteScript, selected], {
    cwd: gitRepo(tags),
    encoding: "utf8",
  }).trim();
}

function classify(status, output) {
  return execFileSync("bash", [classifyScript, String(status)], {
    input: output,
    encoding: "utf8",
  }).trim();
}

test("promotes only the newest stable tag to :latest", () => {
  const tags = ["v1.0.0", "v1.2.0", "v1.2.0-beta.1", "v1.3.0-rc.1"];
  assert.equal(promoteLatest("v1.2.0", tags), "true");
  assert.equal(promoteLatest("v1.0.0", tags), "false");
  assert.equal(promoteLatest("v1.3.0-rc.1", tags), "false");
});

test("rejects a version that is not a v-prefixed release", () => {
  for (const selected of ["1.2.0", "latest"]) {
    assert.throws(
      () => promoteLatest(selected, ["v1.2.0"]),
      (error) => {
        assert.match(String(error.stderr ?? ""), /invalid version/);
        return true;
      },
    );
  }
});

test("classifies a successful manifest inspect as exists", () => {
  assert.equal(classify(0, "schemaVersion: 2\n"), "exists");
});

test("classifies a confirmed missing manifest as not_found", () => {
  assert.equal(
    classify(1, "manifest unknown: ghcr.io/quantus-network/monitoring-grafana:v1.2.3"),
    "not_found",
  );
  assert.equal(classify(1, "no such manifest: missing"), "not_found");
  assert.equal(
    classify(1, "manifest for ghcr.io/quantus-network/monitoring-grafana:v1.2.3 not found"),
    "not_found",
  );
});

test("classifies registry and network failures as error", () => {
  assert.equal(classify(1, "no such host"), "error");
  assert.equal(classify(1, "unauthorized: authentication required"), "error");
  assert.equal(classify(1, ""), "error");
});

test("rejects a non-numeric inspect status", () => {
  assert.throws(
    () => classify("nope", "manifest unknown"),
    (error) => {
      assert.match(String(error.stderr ?? ""), /invalid exit code/);
      return true;
    },
  );
});
