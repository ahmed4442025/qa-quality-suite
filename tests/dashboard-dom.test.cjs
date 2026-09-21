const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");
const postcss = require("postcss");
const dashboardRoot = path.join(__dirname, "../skills/qa-init/template/qa_dashboard");
const root = path.join(dashboardRoot, "app");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const source = (name) => fs.readFileSync(path.join(root, "js", name), "utf8");
const settle = () => new Promise((resolve) => setImmediate(resolve));

function setup(t, { tasks, query = "", fetcher, drawerWidth, projectName } = {}) {
  const dom = new JSDOM(html, {
    url: `http://localhost/app/index.html${query}`,
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  const w = dom.window;
  t.after(() => w.close());
  // This is a DOM/controller test, not a browser/layout or native dialog test.
  if (!w.HTMLDialogElement.prototype.showModal) {
    w.HTMLDialogElement.prototype.showModal = function () {
      this.open = true;
    };
    w.HTMLDialogElement.prototype.close = function () {
      this.open = false;
      this.dispatchEvent(new w.Event("close"));
    };
  }
  w.HTMLElement.prototype.scrollIntoView = function () {};
  w.fetch =
    fetcher || (async () => ({ ok: true, json: async () => ({ ok: true }) }));
  Object.defineProperty(w.navigator, "clipboard", {
    value: { writeText: async () => {} },
  });
  if (drawerWidth) w.localStorage.setItem("qa_drawer_width", drawerWidth);
  if (tasks)
    w.MODULE_TEST = { moduleId: "test", moduleName: "وحدة الاختبار", tasks };
  else w.eval(fs.readFileSync(path.join(dashboardRoot, "data/temp.js"), "utf8"));
  w.eval(fs.readFileSync(path.join(dashboardRoot, "config.js"), "utf8"));
  if (projectName) w.QA_CONFIG = Object.freeze({ projectName });
  w.eval(source("model.js"));
  w.eval(source("app.js"));
  const d = w.document;
  return {
    w,
    d,
    $: (id) => d.getElementById(id),
    change(id, value) {
      const el = d.getElementById(id);
      el.value = value;
      el.dispatchEvent(
        new w.Event(el.tagName === "INPUT" ? "input" : "change", {
          bubbles: true,
        }),
      );
    },
  };
}
function findings(count = 3) {
  return Array.from({ length: count }, (_, i) => ({
    id: `T-${i + 1}`,
    title: `المشكلة ${i + 1}`,
    file: `src/test${i}.dart:12`,
    status: i === 1 ? "done" : "pending",
    severity: i === 0 ? "Critical" : "High",
    types: ["bug"],
    culprit: "Mobile",
    testScenario: "اختبار أول\nاختبار ثان",
    technicalAnalysis: "السبب هو `double`",
    solution: "```dart\nfinal x = 1;\n```",
  }));
}
test("the original sample renders with a usable title, critical count, and full details", (t) => {
  const { d, $ } = setup(t);
  assert.equal(d.querySelectorAll(".issue-table tbody tr").length, 1);
  assert.equal($("statCritical").textContent, "1");
  assert.equal($("statHigh").textContent, "0");
  assert.equal($("statTotal").textContent, "1");
  assert.equal($("resultsSummary").textContent, "1 مشكلة");
  assert.equal($("projectName").textContent, "قالب تجريبي");
  assert.equal(d.querySelector(".overview"), null);
  assert.equal(d.querySelector("#resultsCount"), null);
  assert.match($("resultsHeading").className, /sr-only/);
  const row = d.querySelector(".issue-table tbody tr");
  assert.equal(row.children.length, 5);
  assert.deepEqual(
    [...d.querySelectorAll(".issue-table th")].map((cell) =>
      cell.textContent.trim(),
    ),
    ["#", "المشكلة", "الأهمية", "الوحدة", "الحالة"],
  );
  assert.equal(row.querySelector(".issue-index").textContent, "0");
  assert.doesNotMatch(row.textContent, /agent_inventory|الموبايل/);
  assert.equal(d.querySelector(".metric-bottom"), null);
  assert.equal(d.querySelector(".issue-table [data-copy-file]"), null);
  row.children[2].click();
  assert.equal($("taskDialog").open, true);
  assert.equal(
    $("detailHeaderMeta").textContent.includes("بطاقة المشكلة"),
    false,
  );
  assert.match($("detailHeaderMeta").textContent, /SMP-01/);
  assert.ok($("detailHeaderMeta").querySelector(".severity"));
  assert.ok($("detailHeaderMeta").querySelector("[data-status-id]"));
  assert.ok($("detailHeaderMeta").querySelector("[data-copy-value='SMP-01']"));
  assert.equal(
    $("detailHeaderMeta").querySelectorAll(".status-option").length,
    5,
  );
  assert.equal(
    $("detailHeaderMeta").querySelectorAll(
      '.status-option[aria-pressed="true"]',
    ).length,
    1,
  );
  assert.ok(d.querySelector(".module-badge"));
  assert.equal(
    d.querySelector(".file-reference").textContent.includes("موقع المشكلة"),
    false,
  );
  assert.ok(d.querySelector(".file-reference [data-copy-file]"));
  assert.match($("detailTitle").textContent, /انهيار/);
  assert.match(
    d.querySelector("#detailContent pre code").textContent,
    /toDouble/,
  );
  assert.equal($("toast").parentElement.id, "taskDialog");
  assert.equal(d.querySelectorAll("#detailContent .detail-section").length, 3);
});
test("project identity comes from config without modifying the runtime HTML", (t) => {
  const { d, $ } = setup(t, {
    tasks: findings(),
    projectName: "مشروع المخزون",
  });
  assert.equal($("projectName").textContent, "مشروع المخزون");
  assert.equal(d.title, "مِعيار — ضمان الجودة | مشروع المخزون");
  assert.equal(d.baseURI, "http://localhost/");
  assert.equal(new URL("data/example.js", d.baseURI).pathname, "/data/example.js");
  assert.doesNotMatch(html, /\{\{PROJECT_NAME\}\}/);
});
test("search, clear filters, and explicit empty type selection update the DOM and URL", (t) => {
  const { w, d, $, change } = setup(t, { tasks: findings() });
  change("searchInput", "لايوجد");
  assert.match(d.querySelector(".empty-state h3").textContent, /لا توجد/);
  assert.equal($("activeFiltersBar").hidden, false);
  d.querySelector('.empty-state [data-action="reset"]').click();
  assert.equal(d.querySelectorAll(".issue-table tbody tr").length, 3);
  $("noTypesBtn").click();
  assert.match(w.location.search, /types=/);
  assert.equal(d.querySelectorAll("#typeOptions input:checked").length, 0);
  assert.ok(d.querySelector(".empty-state"));
  $("allTypesBtn").click();
  assert.equal(d.querySelectorAll(".issue-table tbody tr").length, 3);
});
test("clearing search preserves the module and status filters and returns focus", (t) => {
  const { w, d, $, change } = setup(t, { tasks: findings() });
  change("moduleFilter", "test");
  d.querySelector('[data-status-filter="pending"]').click();
  change("searchInput", "no-match");
  assert.equal($("clearSearchBtn").hidden, false);
  $("clearSearchBtn").click();
  assert.equal($("searchInput").value, "");
  assert.equal($("clearSearchBtn").hidden, true);
  assert.equal($("moduleFilter").value, "test");
  assert.equal(
    d.querySelector('[data-status-filter="pending"]').getAttribute("aria-pressed"),
    "true",
  );
  assert.equal(d.querySelectorAll(".issue-row").length, 2);
  assert.equal(d.activeElement, $("searchInput"));
  assert.equal(new URLSearchParams(w.location.search).has("q"), false);
});
test("module options show dynamic counts and the results summary distinguishes visible from total", (t) => {
  const { $, change } = setup(t, { tasks: findings() });
  assert.match($("moduleFilter").options[0].textContent, /\(3\)/);
  assert.match($("moduleFilter").options[1].textContent, /\(3\)/);
  change("severityFilter", "Critical");
  assert.equal($("resultsSummary").textContent, "عرض 1 من أصل 3 مشكلة");
  assert.match($("moduleFilter").options[0].textContent, /\(1\)/);
  assert.match($("moduleFilter").options[1].textContent, /\(1\)/);
});
test("an active metric toggles off without losing module or platform scope", (t) => {
  const { d, $, change } = setup(t, { tasks: findings() });
  change("moduleFilter", "test");
  change("culpritFilter", "Mobile");
  const metric = d.querySelector('[data-preset="critical"]');
  metric.click();
  assert.equal(metric.getAttribute("aria-pressed"), "true");
  assert.equal(d.querySelectorAll(".issue-row").length, 1);
  metric.click();
  assert.equal(metric.getAttribute("aria-pressed"), "false");
  assert.equal(d.querySelectorAll('[data-status-filter][aria-pressed="true"]').length, 0);
  assert.equal($("severityFilter").value, "all");
  assert.equal($("moduleFilter").value, "test");
  assert.equal($("culpritFilter").value, "Mobile");
  assert.equal(d.querySelectorAll(".issue-row").length, 3);
});
test("metric shortcuts clear incompatible filters so their counts match the results", (t) => {
  const { d, $, change } = setup(t, { tasks: findings() });
  change("searchInput", "no-match");
  $("noTypesBtn").click();
  d.querySelector('[data-preset="critical"]').click();
  assert.equal($("searchInput").value, "");
  assert.equal(
    d.querySelectorAll(".issue-table tbody tr").length,
    Number($("statCritical").textContent),
  );
  assert.equal(
    d.querySelectorAll('[data-status-filter][aria-pressed="true"]').length,
    2,
  );
  assert.equal($("severityFilter").value, "Critical");
});
test("the high-priority half filters only open high findings", (t) => {
  const { d, $ } = setup(t, { tasks: findings() });
  d.querySelector('[data-preset="high"]').click();
  assert.equal($("severityFilter").value, "High");
  assert.equal(d.querySelectorAll(".issue-row").length, 1);
  assert.equal(d.querySelector(".issue-row .issue-id").textContent, "T-3");
});
test("deep links open the chosen task, retain filters, and render safe source text", (t) => {
  const tasks = findings();
  tasks[0].title = '<img src=x onerror="window.compromised=true">';
  tasks[0].solution = "```html\n<script>window.compromised=true</script>\n```";
  const { w, d, $ } = setup(t, {
    tasks,
    query: "?task=T-1&status=open&view=report",
  });
  assert.equal($("taskDialog").open, true);
  assert.equal(d.querySelectorAll(".report-card").length, 2);
  assert.equal(
    d.querySelectorAll("#results img, #detailContent script").length,
    0,
  );
  assert.equal(w.compromised, undefined);
  assert.match(
    d.querySelector("#detailContent code[id]").textContent,
    /<script>/,
  );
  const ids = [...d.querySelectorAll("[id]")].map((el) => el.id);
  assert.equal(new Set(ids).size, ids.length);
});
test("103 findings paginate without losing the search field or reaching an empty page", (t) => {
  const { w, d, $, change } = setup(t, {
    tasks: findings(103),
    query: "?page=99",
  });
  assert.equal(d.querySelectorAll(".issue-table tbody tr").length, 3);
  assert.equal($("nextPageBtn").disabled, true);
  assert.equal(d.querySelectorAll("#pageNumbers [data-page]").length, 5);
  assert.equal(
    d.querySelector("#pageNumbers [aria-current='page']").dataset.page,
    "5",
  );
  $("prevPageBtn").click();
  assert.equal(d.querySelectorAll(".issue-table tbody tr").length, 25);
  change("pageSizeSelect", "50");
  assert.equal(d.querySelectorAll(".issue-table tbody tr").length, 50);
  assert.equal(new URLSearchParams(w.location.search).get("pageSize"), "50");
  d.querySelector('#pageNumbers [data-page="3"]').click();
  assert.equal(d.querySelectorAll(".issue-table tbody tr").length, 3);
  assert.equal(d.querySelector(".issue-index").textContent, "100");
  change("searchInput", "المشكلة 103");
  assert.equal(d.querySelectorAll(".issue-table tbody tr").length, 1);
  assert.equal($("pagination").hidden, true);
});
test("completion follows every filter including multi-selected statuses", (t) => {
  const { d, $, change } = setup(t, { tasks: findings() });
  assert.equal($("completionValue").textContent, "1 / 3");
  change("searchInput", "المشكلة 2");
  assert.equal($("completionValue").textContent, "1 / 1");
  change("searchInput", "");
  d.querySelector('[data-status-filter="done"]').click();
  assert.equal($("completionValue").textContent, "1 / 1");
  d.querySelector('[data-status-filter="pending"]').click();
  assert.equal($("completionValue").textContent, "1 / 3");
  d.querySelector('[data-status-filter="done"]').click();
  assert.equal($("completionValue").textContent, "0 / 2");
  change("severityFilter", "Critical");
  assert.equal($("completionValue").textContent, "0 / 1");
});
test("detail report cards collapse to a compact row and expand again", (t) => {
  const { d } = setup(t, { tasks: findings(), query: "?view=report" });
  let card = d.querySelector(".report-card");
  let toggle = card.querySelector("[data-toggle-report]");
  assert.ok(card.querySelector(".report-card-body"));
  assert.equal(toggle.getAttribute("aria-expanded"), "true");
  toggle.click();
  card = d.querySelector(".report-card");
  toggle = card.querySelector("[data-toggle-report]");
  assert.match(card.className, /is-collapsed/);
  assert.equal(card.querySelector(".report-card-body"), null);
  assert.ok(card.querySelector(".report-compact-row .issue-title"));
  assert.equal(toggle.getAttribute("aria-expanded"), "false");
  toggle.click();
  card = d.querySelector(".report-card");
  assert.ok(card.querySelector(".report-card-body"));
});
test("task board renders five states, opens details, and moves a card", async (t) => {
  const calls = [];
  const { w, d, $ } = setup(t, {
    tasks: findings(),
    query: "?view=board",
    fetcher: async (_, options) => {
      calls.push(JSON.parse(options.body));
      return { ok: true, json: async () => ({ ok: true }) };
    },
  });
  assert.equal(d.querySelectorAll(".board-column").length, 5);
  assert.equal(d.querySelectorAll('[data-board-status="pending"] .board-card').length, 2);
  assert.equal(d.querySelectorAll('[data-board-status="done"] .board-card').length, 1);
  assert.equal($("pagination").hidden, true);
  d.querySelector('[data-board-task="T-1"] .board-card-title').click();
  assert.equal($("taskDialog").open, true);
  $("closeDetailBtn").click();
  const move = d.querySelector('[data-board-move-id="T-1"]');
  move.value = "in_progress";
  move.dispatchEvent(new w.Event("change", { bubbles: true }));
  assert.ok(d.querySelector('[data-board-status="in_progress"] [data-board-task="T-1"]'));
  await settle();
  assert.deepEqual(calls, [{ id: "T-1", status: "in_progress" }]);
  assert.equal(d.querySelector('[data-view="board"]').getAttribute("aria-pressed"), "true");
});
test("task board drag and drop persists the destination status", async (t) => {
  const calls = [];
  const { w, d } = setup(t, {
    tasks: findings(),
    query: "?view=board",
    fetcher: async (_, options) => {
      calls.push(JSON.parse(options.body));
      return { ok: true, json: async () => ({ ok: true }) };
    },
  });
  const card = d.querySelector('[data-board-task="T-1"]');
  const dataTransfer = {
    effectAllowed: "none",
    dropEffect: "none",
    setData() {},
  };
  const start = new w.Event("dragstart", { bubbles: true, cancelable: true });
  Object.defineProperty(start, "dataTransfer", { value: dataTransfer });
  card.dispatchEvent(start);
  assert.match(card.className, /is-dragging/);
  const target = d.querySelector('[data-board-status="done"]');
  const over = new w.Event("dragover", { bubbles: true, cancelable: true });
  Object.defineProperty(over, "dataTransfer", { value: dataTransfer });
  target.dispatchEvent(over);
  assert.equal(over.defaultPrevented, true);
  assert.match(target.className, /is-drop-target/);
  const drop = new w.Event("drop", { bubbles: true, cancelable: true });
  Object.defineProperty(drop, "dataTransfer", { value: dataTransfer });
  target.dispatchEvent(drop);
  assert.ok(d.querySelector('[data-board-status="done"] [data-board-task="T-1"]'));
  await settle();
  assert.deepEqual(calls, [{ id: "T-1", status: "done" }]);
});
test("save and undo use the existing API; duplicate clicks cannot start concurrent saves", async (t) => {
  const calls = [];
  let finish;
  const { w, d, $ } = setup(t, {
    tasks: findings(),
    fetcher: async (_, options) => {
      calls.push(JSON.parse(options.body));
      if (calls.length === 1)
        return new Promise((resolve) => {
          finish = resolve;
        });
      return { ok: true, json: async () => ({ ok: true }) };
    },
  });
  const done = d.querySelector(
    '[data-status-id="T-1"][data-status-value="done"]',
  );
  done.focus();
  done.click();
  assert.ok(
    [...d.querySelectorAll('[data-status-id="T-1"]')].every(
      (button) => button.disabled,
    ),
  );
  assert.equal(
    d
      .querySelector('[data-status-id="T-1"][data-status-value="done"]')
      .getAttribute("aria-pressed"),
    "true",
  );
  assert.equal($("statOpen").textContent, "2");
  d.querySelector(
    '[data-status-id="T-1"][data-status-value="archived"]',
  ).click();
  assert.equal(calls.length, 1);
  finish({ ok: true, json: async () => ({ ok: true }) });
  await settle();
  assert.equal($("statOpen").textContent, "1");
  assert.equal($("toastAction").hidden, false);
  $("toastAction").click();
  await settle();
  assert.deepEqual(calls, [
    { id: "T-1", status: "done" },
    { id: "T-1", status: "pending" },
  ]);
  assert.equal($("statOpen").textContent, "2");
});
test("failed persistence leaves the previous status and presents an accessible error", async (t) => {
  const { w, d, $ } = setup(t, {
    tasks: findings(),
    fetcher: async () => {
      throw new Error("offline");
    },
  });
  d.querySelector('[data-status-id="T-1"][data-status-value="done"]').click();
  await settle();
  assert.equal(
    d
      .querySelector('[data-status-id="T-1"][aria-pressed="true"]')
      .getAttribute("data-status-value"),
    "pending",
  );
  assert.equal($("toast").dataset.tone, "error");
  assert.equal($("toastMessage").getAttribute("role"), "status");
  assert.match($("toastMessage").textContent, /تعذر/);
});
test("a saved issue can leave the filtered list while its detail panel stays usable", async (t) => {
  const { w, d, $ } = setup(t, {
    tasks: findings(),
    query: "?status=open&task=T-1",
  });
  d.querySelector('#detailHeaderMeta [data-status-value="done"]').click();
  await settle();
  assert.equal($("taskDialog").open, true);
  assert.match(d.querySelector(".dialog-note").textContent, /خارج التصفية/);
  assert.equal($("nextTaskBtn").disabled, true);
  $("closeDetailBtn").click();
  await settle();
  assert.equal($("taskDialog").open, false);
  assert.equal($("toast").parentElement, d.body);
});
test("copy errors, keyboard search, theme state, and empty modules have explicit outcomes", async (t) => {
  const { w, d, $ } = setup(t, { tasks: findings() });
  d.body.dispatchEvent(
    new w.KeyboardEvent("keydown", { key: "/", bubbles: true }),
  );
  assert.equal(d.activeElement, $("searchInput"));
  $("themeToggleBtn").click();
  assert.equal(d.documentElement.dataset.theme, "dark");
  assert.equal(w.localStorage.getItem("qa_theme"), "dark");
  d.querySelector(".issue-title").click();
  w.navigator.clipboard.writeText = async () => {
    throw new Error("denied");
  };
  d.querySelector("#detailContent [data-copy-file]").click();
  await settle();
  assert.match($("toastMessage").textContent, /تعذر النسخ/);
  const empty = setup(t, { tasks: [] });
  assert.match(
    empty.d.querySelector(".empty-state h3").textContent,
    /لأول فحص/,
  );
  assert.equal(empty.$("completionValue").textContent, "0 / 0");
});
test("successful copy gives a half-second check animation and returns to the copy icon", async (t) => {
  const { d } = setup(t, { tasks: findings() });
  d.querySelector(".issue-title").click();
  const button = d.querySelector("#detailHeaderMeta [data-copy-value]");
  const original = button.innerHTML;
  button.click();
  await settle();
  assert.equal(button.classList.contains("copy-confirmed"), true);
  assert.equal(button.getAttribute("aria-label"), "تم النسخ");
  assert.notEqual(button.innerHTML, original);
  await new Promise((resolve) => setTimeout(resolve, 550));
  assert.equal(button.classList.contains("copy-confirmed"), false);
  assert.equal(button.innerHTML, original);
});
test("drawer width is keyboard-resizable, resettable, and restored after refresh", (t) => {
  const first = setup(t, { tasks: findings() });
  const handle = first.$("drawerResizeHandle");
  assert.equal(
    first.$("taskDialog").style.getPropertyValue("--drawer-width"),
    "760px",
  );
  handle.dispatchEvent(
    new first.w.KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }),
  );
  assert.equal(
    first.$("taskDialog").style.getPropertyValue("--drawer-width"),
    "784px",
  );
  assert.equal(first.w.localStorage.getItem("qa_drawer_width"), "784");
  const refreshed = setup(t, { tasks: findings(), drawerWidth: 784 });
  assert.equal(
    refreshed.$("taskDialog").style.getPropertyValue("--drawer-width"),
    "784px",
  );
  refreshed
    .$("drawerResizeHandle")
    .dispatchEvent(new refreshed.w.Event("dblclick"));
  assert.equal(
    refreshed.$("taskDialog").style.getPropertyValue("--drawer-width"),
    "760px",
  );
  assert.equal(refreshed.w.localStorage.getItem("qa_drawer_width"), "760");
});
test("all input controls have names and semantic colors pass small-text contrast checks", (t) => {
  const { d } = setup(t);
  for (const input of d.querySelectorAll("input, select")) {
    assert.ok(
      input.getAttribute("aria-label") || input.labels?.length,
      `Unnamed control: ${input.id}`,
    );
  }
  const ast = postcss.parse(
    fs.readFileSync(path.join(root, "css/style.css"), "utf8"),
  );
  const palettes = [];
  ast.walkRules((rule) => {
    if (
      rule.selector === ":root" ||
      rule.selector === ':root[data-theme="dark"]'
    ) {
      const palette = {};
      rule.walkDecls((decl) => {
        palette[decl.prop] = decl.value;
      });
      palettes.push(palette);
    }
  });
  function luminance(hex) {
    const rgb =
      hex.slice(1).length === 3
        ? hex
            .slice(1)
            .split("")
            .map((c) => c + c)
            .join("")
        : hex.slice(1);
    const values = rgb
      .match(/../g)
      .map((c) => parseInt(c, 16) / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
  }
  assert.equal(palettes.length, 2);
  for (const palette of palettes) {
    for (const [fg, bg] of [
      ["ink", "surface"],
      ["muted", "bg"],
      ["muted", "soft"],
      ["accent", "tint"],
      ["critical", "critical-bg"],
      ["cancelled", "cancelled-bg"],
      ["high", "high-bg"],
      ["medium", "medium-bg"],
      ["low", "low-bg"],
      ["success", "success-bg"],
    ]) {
      const a = luminance(palette[`--${fg}`]),
        b = luminance(palette[`--${bg}`]);
      const contrast = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      assert.ok(contrast >= 4.5, `${fg}/${bg}: ${contrast.toFixed(2)}`);
    }
  }
});
