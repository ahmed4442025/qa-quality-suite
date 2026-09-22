const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");

const reportRoot = path.join(__dirname, "../skills/qa-init/template/qa_report");
const html = fs.readFileSync(path.join(reportRoot, "index.html"), "utf8");
const source = (name) => fs.readFileSync(path.join(reportRoot, "js", name), "utf8");

function setup(t, { tasks, query = "" } = {}) {
  const dom = new JSDOM(html, {
    url: `http://localhost/index.html${query}`,
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  const w = dom.window;
  t.after(() => w.close());
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
  w.fetch = () => assert.fail("The read-only report must never call a status API");
  if (tasks) {
    w.MODULE_TEST = {
      moduleId: "test",
      moduleName: "وحدة الاختبار",
      tasks,
    };
  } else {
    w.eval(fs.readFileSync(path.join(reportRoot, "data/temp.js"), "utf8"));
  }
  w.eval(source("model.js"));
  w.eval(source("app.js"));
  return {
    w,
    d: w.document,
    $: (id) => w.document.getElementById(id),
    change(id, value) {
      const element = w.document.getElementById(id);
      element.value = value;
      element.dispatchEvent(
        new w.Event(element.tagName === "INPUT" ? "input" : "change", {
          bubbles: true,
        }),
      );
    },
  };
}

function findings() {
  return [
    {
      id: "PM-10",
      title: "تعطل إتمام الطلب",
      severity: "Critical",
      status: "pending",
      types: ["bug"],
      culprit: "Mobile",
      file: "checkout.dart:97",
      testScenario: "1. افتح الطلب\n2. اضغط إتمام\n\nالأثر: يتعذر إتمام البيع.",
      technicalAnalysis: "private-root-cause-token",
      solution: "private-fix-token",
    },
    {
      id: "PM-2",
      title: "تم إصلاح تأخر التقرير",
      severity: "Medium",
      status: "done",
      types: ["perf"],
      culprit: "Backend",
      testScenario: "افتح التقرير وتحقق من زمن التحميل.",
      technicalAnalysis: "database index",
      solution: "add index",
    },
  ];
}

test("report matches the dashboard shell but exposes only read-only status", (t) => {
  const { d, $ } = setup(t, { tasks: findings() });
  assert.equal(d.querySelectorAll(".metrics .metric").length, 4);
  assert.equal(d.querySelectorAll("[data-view]").length, 2);
  assert.equal(d.querySelector('[data-view="board"]'), null);
  assert.match(d.querySelector(".readonly-badge").textContent, /للعرض فقط/);
  assert.equal(d.querySelectorAll(".issue-row").length, 2);
  assert.equal(d.querySelectorAll(".status-badge").length, 2);
  assert.equal(d.querySelector("[data-status-value]"), null);
  assert.equal(d.querySelector("[data-status-id]"), null);
  assert.equal(typeof d.defaultView.QAModel.persistStatus, "undefined");
  const [publicFinding] = d.defaultView.QAModel.normalize([
    { moduleId: "x", tasks: [findings()[0]] },
  ]);
  assert.equal(Object.hasOwn(publicFinding, "file"), false);
  assert.equal(Object.hasOwn(publicFinding, "technicalAnalysis"), false);
  assert.equal(Object.hasOwn(publicFinding, "solution"), false);
  assert.equal($("statOpen").textContent, "1");
  assert.equal($("statDone").textContent, "1");
});

test("details never render file locations, technical analysis, or solutions", (t) => {
  const { d, $ } = setup(t, { tasks: findings() });
  d.querySelector(".issue-title").click();
  assert.equal($("taskDialog").open, true);
  assert.equal(d.querySelector("#detailContent .detail-section").textContent.includes("التجربة والأثر"), true);
  assert.equal(d.querySelector("#detailContent .file-reference"), null);
  assert.equal(d.querySelector("#detailContent").textContent.includes("checkout.dart"), false);
  assert.equal(d.querySelector("#detailContent").textContent.includes("private-root-cause-token"), false);
  assert.equal(d.querySelector("#detailContent").textContent.includes("private-fix-token"), false);
  assert.equal(d.querySelector("#detailHeaderMeta [data-status-value]"), null);
});

test("search ignores hidden engineering fields and keeps PM-facing filters and sorting", (t) => {
  const { d, $, change, w } = setup(t, { tasks: findings() });
  change("searchInput", "private-root-cause-token");
  assert.ok(d.querySelector(".empty-state"));
  change("searchInput", "إتمام البيع");
  assert.equal(d.querySelectorAll(".issue-row").length, 1);
  change("searchInput", "");
  change("sortSelect", "id");
  assert.equal(d.querySelector(".issue-row .issue-id").textContent, "PM-2");
  d.querySelector('[data-status-filter="done"]').click();
  assert.equal(d.querySelectorAll(".issue-row").length, 1);
  assert.match(w.location.search, /statuses=done/);
  assert.equal($("sortSelect").value, "id");
});

test("the details view stays PM-safe and a board deep link falls back to the list", (t) => {
  const report = setup(t, { tasks: findings(), query: "?view=report" });
  assert.equal(report.d.querySelectorAll(".report-card").length, 2);
  assert.equal(report.d.querySelector(".report-card .file-reference"), null);
  assert.equal(report.d.querySelector(".report-card").textContent.includes("private-fix-token"), false);
  assert.equal(report.d.querySelectorAll(".report-card .status-badge").length, 2);

  const board = setup(t, { tasks: findings(), query: "?view=board" });
  assert.equal(board.d.querySelectorAll(".issue-row").length, 2);
  assert.equal(board.d.querySelector(".board-shell"), null);
  assert.equal(board.d.querySelector('[data-view="list"]').getAttribute("aria-pressed"), "true");
});
