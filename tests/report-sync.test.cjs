const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { spawnSync } = require("node:child_process");

const syncScript = path.join(
  __dirname,
  "../skills/qa-init/template/qa_dashboard/app/js/sync-report.cjs",
);
const sync = require(syncScript);

function workspace(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "qa-report-sync-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const dashboard = path.join(root, "qa_dashboard");
  const report = path.join(root, "qa_report");
  fs.mkdirSync(path.join(dashboard, "data"), { recursive: true });
  fs.mkdirSync(path.join(report, "data"), { recursive: true });
  return { dashboard, report };
}

function write(file, content) {
  fs.writeFileSync(file, content, "utf8");
}

function moduleFile(variable, moduleId, moduleName, tasks) {
  return `window.${variable} = ${JSON.stringify({ moduleId, moduleName, tasks }, null, 2)};\n`;
}

function generatedTasks(report) {
  const sandbox = { window: {} };
  vm.runInNewContext(
    fs.readFileSync(path.join(report, "data", "completed.js"), "utf8"),
    sandbox,
  );
  return Object.values(sandbox.window).flatMap((module) => module.tasks);
}

test("sync exports only done findings and strips engineering fields", (t) => {
  const { dashboard, report } = workspace(t);
  write(path.join(dashboard, "done.md"), "AUTH-01\nINV-02\nAUTH-01\n");
  write(
    path.join(dashboard, "data", "manifest.js"),
    '["data/auth.js", "data/inventory.js"].forEach(function () {});',
  );
  write(
    path.join(dashboard, "data", "auth.js"),
    moduleFile("MODULE_AUTH", "auth", "Authentication", [
      {
        id: "AUTH-01",
        title: "Latest auth title",
        types: ["security"],
        severity: "Critical",
        file: "auth.dart:42",
        culprit: "Mobile",
        requiresBackend: true,
        status: "pending",
        testScenario: "1. Sign in",
        technicalAnalysis: "secret root cause",
        solution: "secret fix",
      },
      { id: "AUTH-99", title: "Not completed" },
    ]),
  );
  write(
    path.join(dashboard, "data", "inventory.js"),
    moduleFile("MODULE_INVENTORY", "inventory", "Inventory", [
      {
        id: "INV-02",
        title: "Inventory issue",
        type: "bug",
        severity: "High",
        culprit: "Backend",
        status: "done",
        testScenario: "1. Open inventory",
      },
    ]),
  );

  assert.deepEqual(sync.syncReport(dashboard, report), { issues: 2, modules: 2 });
  const tasks = generatedTasks(report);
  assert.deepEqual(tasks.map((task) => task.id), ["AUTH-01", "INV-02"]);
  assert.equal(tasks[0].title, "Latest auth title");
  assert.equal(tasks[0].culprit, "Both");
  assert.equal(tasks[0].status, "done");
  for (const task of tasks) {
    for (const field of ["file", "technicalAnalysis", "solution", "requiresBackend"])
      assert.equal(Object.hasOwn(task, field), false, `${task.id}: ${field}`);
  }
  assert.match(
    fs.readFileSync(path.join(report, "data", "manifest.js"), "utf8"),
    /data\/completed\.js/,
  );
});

test("a second sync replaces an existing ID instead of duplicating it", (t) => {
  const { dashboard, report } = workspace(t);
  write(path.join(dashboard, "done.md"), "BUG-01\n");
  write(path.join(dashboard, "data", "manifest.js"), '["data/bugs.js"]');
  const source = path.join(dashboard, "data", "bugs.js");
  write(
    source,
    moduleFile("MODULE_BUGS", "bugs", "Bugs", [
      { id: "BUG-01", title: "Old title", testScenario: "Old scenario" },
    ]),
  );
  write(
    path.join(report, "data", "completed.js"),
    moduleFile("MODULE_OLD", "old", "Old", [
      { id: "BUG-01", title: "Stale report copy" },
    ]),
  );

  sync.syncReport(dashboard, report);
  write(
    source,
    moduleFile("MODULE_BUGS", "bugs", "Bugs", [
      { id: "BUG-01", title: "New title", testScenario: "New scenario" },
    ]),
  );
  sync.syncReport(dashboard, report);

  const tasks = generatedTasks(report);
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].id, "BUG-01");
  assert.equal(tasks[0].title, "New title");
  assert.equal(tasks[0].testScenario, "New scenario");
});

test("the command-line entry prints English-only status messages", (t) => {
  const { dashboard, report } = workspace(t);
  write(path.join(dashboard, "done.md"), "BUG-01\n");
  write(path.join(dashboard, "data", "manifest.js"), '["data/bugs.js"]');
  write(
    path.join(dashboard, "data", "bugs.js"),
    moduleFile("MODULE_BUGS", "bugs", "Bugs", [
      { id: "BUG-01", title: "Fixed bug", testScenario: "Retest" },
    ]),
  );
  const result = spawnSync(
    process.execPath,
    [syncScript, "--dashboard", dashboard, "--report", report],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /PM report updated: 1 completed findings/);
  assert.doesNotMatch(`${result.stdout}${result.stderr}`, /[\u0600-\u06ff]/);
});

test("missing or duplicate source IDs fail before changing the report", (t) => {
  const { dashboard, report } = workspace(t);
  const completed = path.join(report, "data", "completed.js");
  write(completed, "keep this report intact");
  write(path.join(dashboard, "done.md"), "MISSING-01\n");
  write(path.join(dashboard, "data", "manifest.js"), '["data/a.js"]');
  write(
    path.join(dashboard, "data", "a.js"),
    moduleFile("MODULE_A", "a", "A", [{ id: "A-01" }]),
  );
  assert.throws(() => sync.syncReport(dashboard, report), /MISSING-01/);
  assert.equal(fs.readFileSync(completed, "utf8"), "keep this report intact");

  write(path.join(dashboard, "done.md"), "A-01\n");
  write(
    path.join(dashboard, "data", "manifest.js"),
    '["data/a.js", "data/b.js"]',
  );
  write(
    path.join(dashboard, "data", "b.js"),
    moduleFile("MODULE_B", "b", "B", [{ id: "A-01" }]),
  );
  assert.throws(() => sync.syncReport(dashboard, report), /duplicated/);
  assert.equal(fs.readFileSync(completed, "utf8"), "keep this report intact");
});
