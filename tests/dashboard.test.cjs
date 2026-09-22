const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const dashboardRoot = path.join(__dirname, "../skills/qa-init/template/qa_dashboard");
const M = require("../skills/qa-init/template/qa_dashboard/app/js/model.js");

test("dashboard template separates replaceable runtime from project data", () => {
  for (const relative of [
    "app/index.html",
    "app/js/app.js",
    "app/js/sync-report.cjs",
    "app/server.ps1",
    "app/run.bat",
    "app/sync-report.ps1",
    "app/sync-report.bat",
    "config.js",
    "data/manifest.js",
    "run.bat",
  ])
    assert.equal(fs.existsSync(path.join(dashboardRoot, relative)), true, relative);
  const html = fs.readFileSync(path.join(dashboardRoot, "app/index.html"), "utf8");
  assert.match(html, /<base href="\.\.\/"/);
  assert.match(html, /src="config\.js"/);
  assert.match(html, /src="data\/manifest\.js"/);
  const server = fs.readFileSync(path.join(dashboardRoot, "app/server.ps1"), "utf8");
  assert.match(server, /Join-Path \$PSScriptRoot "\.\."/);
  assert.match(server, /Join-Path \$dashboardRoot "data"/);
  const launcher = fs.readFileSync(path.join(dashboardRoot, "run.bat"), "utf8");
  assert.match(launcher, /app\\server\.ps1/);
});

test("report sync tooling stays inside the dashboard runtime", () => {
  const reportRoot = path.join(__dirname, "../skills/qa-init/template/qa_report");
  for (const relative of ["sync-report.ps1", "sync-report.bat", "scripts"])
    assert.equal(fs.existsSync(path.join(reportRoot, relative)), false, relative);
  const powershell = fs.readFileSync(
    path.join(dashboardRoot, "app/sync-report.ps1"),
    "utf8",
  );
  assert.match(powershell, /Split-Path -Parent \$PSScriptRoot/);
  assert.match(powershell, /"qa_report"/);
  assert.doesNotMatch(powershell, /[\u0600-\u06ff]/);
});

test("dashboard server handles Ctrl+C without a PowerShell callback deadlock", () => {
  const server = fs.readFileSync(path.join(dashboardRoot, "app/server.ps1"), "utf8");
  assert.match(server, /namespace QaDashboard/);
  assert.match(server, /Console\.CancelKeyPress \+= Handler/);
  assert.match(server, /ConsoleSignal\]::StopRequested/);
  assert.doesNotMatch(server, /\[ConsoleCancelEventHandler\]\s*\{/);
});

function fixtures() {
  return M.normalize([
    {
      moduleId: "inventory",
      moduleName: "📦 Inventory",
      tasks: [
        {
          id: "INV-10",
          title: "انهيار الجرد",
          severity: "Critical",
          status: "pending",
          culprit: "Mobile",
          requiresBackend: true,
          types: ["bug", "perf"],
          file: "stock.dart:12",
          solution: "Use toDouble safely",
        },
        {
          id: "INV-2",
          title: "مشكلة محلولة",
          severity: "Critical",
          status: "done",
          culprit: "Backend",
          type: "security",
        },
        {
          id: "INV-3",
          title: "بطء التحميل",
          severity: "High",
          status: "in_progress",
          culprit: "Mobile",
          types: ["perf"],
        },
        {
          id: "INV-4",
          title: "مؤجلة",
          severity: "Low",
          status: "archived",
          types: ["archive"],
        },
      ],
    },
    {
      moduleId: "sales",
      moduleName: "Sales",
      tasks: [
        {
          id: "SALE-1",
          title: "ملغي",
          severity: "Critical",
          status: "cancelled",
          types: ["bug"],
        },
        {
          id: "SALE-2",
          title: "New category",
          severity: "Medium",
          types: ["custom"],
          file: "new.dart",
        },
      ],
    },
  ]);
}
test("legacy module files normalize without losing fields or altering the source", () => {
  const source = {
    moduleId: "x",
    moduleName: "📦 X",
    tasks: [{ id: "X-1", type: "ui", extraEvidence: "keep" }],
  };
  const [task] = M.normalize([source]);
  assert.equal(task.moduleName, "X");
  assert.equal(task.status, "pending");
  assert.equal(task.extraEvidence, "keep");
  assert.deepEqual(task.types, ["ui"]);
  assert.equal(source.tasks[0].status, undefined);
  assert.deepEqual(M.normalize([null, {}, { tasks: [null] }]), []);
});
test("critical metrics exclude resolved, archived, and cancelled findings", () => {
  assert.deepEqual(M.stats(fixtures()), {
    total: 6,
    open: 3,
    critical: 1,
    high: 1,
    priority: 2,
    in_progress: 1,
    done: 1,
    completionTotal: 4,
  });
  const state = { ...M.defaults(), module: "inventory", culprit: "Backend" };
  assert.deepEqual(
    M.scope(fixtures(), state).map((t) => t.id),
    ["INV-10", "INV-2"],
  );
});
test("combined filters respect both platforms and multi-type OR selection", () => {
  const state = {
    ...M.defaults(),
    module: "inventory",
    statuses: ["pending", "in_progress"],
    culprit: "Both",
    types: ["bug", "security"],
  };
  assert.deepEqual(
    M.filter(fixtures(), state).map((t) => t.id),
    ["INV-10"],
  );
  state.severity = "Low";
  assert.equal(M.filter(fixtures(), state).length, 0);
});
test("search covers technical content, Arabic type labels, and trims whitespace", () => {
  const tasks = fixtures();
  assert.deepEqual(
    M.filter(tasks, { ...M.defaults(), search: "  TODOUBLE  " }).map(
      (t) => t.id,
    ),
    ["INV-10"],
  );
  assert.deepEqual(
    M.filter(tasks, { ...M.defaults(), search: "الأمان" }).map((t) => t.id),
    ["INV-2"],
  );
  assert.deepEqual(
    M.filter(tasks, { ...M.defaults(), search: "stock.dart" }).map((t) => t.id),
    ["INV-10"],
  );
});
test("zero selected types survive URL round trips and yield no results", () => {
  const state = { ...M.defaults(), types: [] };
  assert.equal(M.toUrl(state), "types=");
  const loaded = M.fromUrl(`?${M.toUrl(state)}`, fixtures());
  assert.deepEqual(loaded.types, []);
  assert.equal(M.filter(fixtures(), loaded).length, 0);
});
test("links retain Arabic queries, custom types, view, sorting, and selected task", () => {
  const state = {
    ...M.defaults(),
    search: "اختبار & ملف",
    types: ["custom"],
    view: "report",
    sort: "id",
    statuses: ["done", "archived"],
    page: 2,
    pageSize: 100,
    task: "SALE-2",
  };
  assert.deepEqual(M.fromUrl(M.toUrl(state), fixtures()), state);
  assert.deepEqual(
    M.fromUrl("?status=open", fixtures()).statuses,
    ["pending", "in_progress"],
  );
  assert.deepEqual(
    M.fromUrl(
      "?module=missing&status=bad&severity=no&culprit=no&sort=no&page=-20&task=bad",
      fixtures(),
    ),
    M.defaults(),
  );
});
test("board view survives URL round trips", () => {
  const state = { ...M.defaults(), view: "board" };
  assert.equal(M.toUrl(state), "view=board");
  assert.equal(M.fromUrl("?view=board", fixtures()).view, "board");
});
test("priority sorting is deterministic and IDs use natural ordering", () => {
  const tasks = fixtures(),
    original = tasks.map((t) => t.id);
  assert.deepEqual(
    M.sort(tasks, "id")
      .slice(0, 4)
      .map((t) => t.id),
    ["INV-2", "INV-3", "INV-4", "INV-10"],
  );
  assert.equal(M.sort(tasks, "priority")[0].id, "INV-10");
  assert.deepEqual(
    tasks.map((t) => t.id),
    original,
  );
});
test("pagination handles 103 issues, empty results, and an out-of-range saved page", () => {
  const tasks = Array.from({ length: 103 }, (_, id) => ({ id }));
  assert.equal(M.paginate(tasks, 1).items.length, 25);
  assert.deepEqual(M.paginate(tasks, 90), {
    items: tasks.slice(100),
    page: 5,
    pages: 5,
    pageSize: 25,
    total: 103,
  });
  assert.deepEqual(M.paginate([], 10), {
    items: [],
    page: 1,
    pages: 1,
    pageSize: 25,
    total: 0,
  });
  assert.deepEqual(
    [25, 50, 100, 200].map((size) => M.paginate(tasks, 1, size).items.length),
    [25, 50, 100, 103],
  );
  assert.equal(M.paginate(tasks, 1, 75).pageSize, 25);
});
test("saving keeps the old state until the API confirms the file update", async () => {
  const task = fixtures()[0];
  let finish;
  const response = new Promise((resolve) => {
    finish = resolve;
  });
  const pending = M.persistStatus(task, "done", async (url, options) => {
    assert.equal(url, "/api/status");
    assert.equal(options.method, "POST");
    assert.deepEqual(JSON.parse(options.body), {
      id: "INV-10",
      status: "done",
    });
    return response;
  });
  assert.equal(task.status, "pending");
  finish({ ok: true, json: async () => ({ ok: true }) });
  await pending;
  assert.equal(task.status, "done");
});
test("HTTP, API, network, and malformed response failures preserve the previous state", async () => {
  for (const fetcher of [
    async () => ({ ok: false, json: async () => ({ ok: false }) }),
    async () => ({ ok: true, json: async () => ({ ok: false }) }),
    async () => {
      throw new Error("offline");
    },
    async () => ({
      ok: true,
      json: async () => {
        throw new Error("not JSON");
      },
    }),
  ]) {
    const task = fixtures()[0];
    await assert.rejects(M.persistStatus(task, "done", fetcher));
    assert.equal(task.status, "pending");
  }
});
test("unknown status never reaches the API and source text is escaped", async () => {
  await assert.rejects(
    M.persistStatus(fixtures()[0], "invalid", () =>
      assert.fail("Must not fetch"),
    ),
  );
  assert.equal(
    M.escape("<script>\"&'</script>"),
    "&lt;script&gt;&quot;&amp;&#39;&lt;/script&gt;",
  );
});
