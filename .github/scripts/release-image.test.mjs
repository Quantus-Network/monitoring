import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptsDir, "..", "..");
const promoteScript = join(scriptsDir, "should_promote_latest.sh");
const classifyScript = join(scriptsDir, "classify_manifest_probe.sh");

function gitIn(dir, args) {
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
}

function gitRepo(tags) {
  const dir = mkdtempSync(join(tmpdir(), "monitoring-release-"));
  gitIn(dir, ["init"]);
  writeFileSync(join(dir, "README"), "test\n");
  gitIn(dir, ["add", "README"]);
  gitIn(dir, ["-c", "commit.gpgsign=false", "commit", "-m", "init"]);
  for (const tag of tags) {
    gitIn(dir, ["tag", tag]);
  }
  return dir;
}

function promoteIn(dir, selected) {
  return execFileSync("bash", [promoteScript, selected], {
    cwd: dir,
    encoding: "utf8",
  }).trim();
}

function promoteLatest(selected, tags) {
  return promoteIn(gitRepo(tags), selected);
}

function jobBlock(workflow, name) {
  const marker = `\n  ${name}:\n`;
  const start = workflow.indexOf(marker);
  assert.notEqual(start, -1, `missing job ${name}`);
  const rest = workflow.slice(start + marker.length);
  const next = rest.search(/\n {2}[a-zA-Z0-9_]+:\n/);
  return next === -1 ? rest : rest.slice(0, next);
}

function imageNames(job) {
  return [...job.matchAll(/image_name:\s*(monitoring-[a-z0-9-]+)/g)].map((match) => match[1]);
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

test("an older release loses :latest eligibility once a newer stable tag exists", () => {
  const dir = gitRepo(["v1.0.0"]);
  assert.equal(promoteIn(dir, "v1.0.0"), "true");
  gitIn(dir, ["tag", "v1.1.0"]);
  assert.equal(promoteIn(dir, "v1.1.0"), "true");
  assert.equal(promoteIn(dir, "v1.0.0"), "false");
});

test("moves :latest only after a per-image lock refreshes tags and rechecks eligibility", () => {
  const workflow = readFileSync(join(repoRoot, ".github/workflows/docker-image.yml"), "utf8");
  const determine = jobBlock(workflow, "determine_version");
  const build = jobBlock(workflow, "build_and_publish_image");
  const promote = jobBlock(workflow, "promote_latest");

  assert.doesNotMatch(determine, /should_promote_latest\.sh/);
  assert.match(
    build,
    /group: ghcr-\$\{\{ matrix\.image_name \}\}-\$\{\{ needs\.determine_version\.outputs\.version_with_v \}\}/,
  );
  assert.doesNotMatch(build, /:latest/);
  assert.doesNotMatch(build, /should_promote_latest\.sh/);

  assert.match(promote, /needs:\s*\[determine_version, build_and_publish_image\]/);
  assert.match(promote, /always\(\)/);
  assert.match(promote, /needs\.build_and_publish_image\.result == 'success'/);
  assert.match(promote, /needs\.build_and_publish_image\.result == 'failure'/);
  assert.match(promote, /fail-fast:\s*false/);
  const concurrency = promote.slice(promote.indexOf("concurrency:"), promote.indexOf("steps:"));
  assert.match(concurrency, /cancel-in-progress:\s*false/);
  assert.match(concurrency, /queue:\s*max/);
  assert.match(concurrency, /group: ghcr-\$\{\{ matrix\.image_name \}\}-latest/);
  assert.doesNotMatch(concurrency, /version_with_v/);

  const fetchAt = promote.indexOf("git fetch origin --tags --force");
  const scriptAt = promote.indexOf("should_promote_latest.sh");
  const classifyAt = promote.indexOf("classify_manifest_probe.sh");
  const moveAt = promote.indexOf("imagetools create");
  assert.ok(fetchAt !== -1 && scriptAt !== -1 && classifyAt !== -1 && moveAt !== -1);
  assert.ok(fetchAt < scriptAt && scriptAt < classifyAt && classifyAt < moveAt);
  assert.match(promote.slice(moveAt), /--prefer-index=false/);
  assert.deepEqual(imageNames(promote), imageNames(build));
});
