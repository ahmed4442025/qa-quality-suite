/* Miyar dashboard. No build step; data/manifest.js is the source of project findings. */
(function () {
  "use strict";
  const M = window.QAModel;
  const $ = (id) => document.getElementById(id);
  const esc = M.escape;
  const tasks = M.normalize(
    Object.keys(window)
      .filter((key) => key.startsWith("MODULE_"))
      .map((key) => window[key]),
  );
  const types = M.typeKeys(tasks);
  let state = M.fromUrl(location.search, tasks);
  let filtered = [];
  let returnFocusKey = "";
  let toastTimer;
  let toastAction;
  let codeSequence = 0;
  const copyFeedback = new WeakMap();
  const saving = new Set();
  const savingTargets = new Map();
  const collapsedReports = new Set();
  let draggedTaskId = "";
  const DRAWER_WIDTH_KEY = "qa_drawer_width";
  const DEFAULT_DRAWER_WIDTH = 760;
  const MIN_DRAWER_WIDTH = 440;
  const MAX_DRAWER_WIDTH = 1100;
  let preferredDrawerWidth = DEFAULT_DRAWER_WIDTH;
  const platformNames = {
    all: "كل المنصات",
    Mobile: "الموبايل",
    Backend: "الخادم",
    Both: "الموبايل والخادم",
  };
  const icons = {
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/>',
    filter: '<path d="M4 7h16M7 12h10M10 17h4"/>',
    sort: '<path d="M8 6h10M8 12h7M8 18h4M4 6h.01M4 12h.01M4 18h.01"/>',
    chevron: '<path d="m7 10 5 5 5-5"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    arrow: '<path d="M19 12H5m6-6-6 6 6 6"/>',
    "arrow-right": '<path d="M5 12h14m-6-6 6 6-6 6"/>',
    refresh:
      '<path d="M20 7v5h-5M4 17v-5h5M6 6a8 8 0 0 1 13 3M18 18a8 8 0 0 1-13-3"/>',
    moon: '<path d="M20.5 14a8.6 8.6 0 0 1-10.6-10.5A8.8 8.8 0 1 0 20.5 14Z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5"/>',
    alert: '<path d="m12 3 10 18H2L12 3Zm0 6v5m0 3h.01"/>',
    activity: '<path d="M2 12h5l3-8 4 16 3-8h5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    archive: '<path d="M4 7h16v13H4V7Zm-1-4h18v4H3V3Zm7 8h4"/>',
    cancel: '<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6m0-6-6 6"/>',
    list: '<path d="M9 6h12M9 12h12M9 18h12M3 6h.01M3 12h.01M3 18h.01"/>',
    document: '<path d="M14 2H5v20h14V7l-5-5Zm0 0v5h5M8 12h8M8 16h8"/>',
    board: '<rect x="3" y="4" width="5" height="16" rx="1"/><rect x="10" y="4" width="5" height="11" rx="1"/><rect x="17" y="4" width="4" height="14" rx="1"/>',
    grip: '<path d="M8 6h.01M16 6h.01M8 12h.01M16 12h.01M8 18h.01M16 18h.01"/>',
    copy: '<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
  };
  function icon(name) {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.document}</svg>`;
  }
  function fillIcons(root = document) {
    root.querySelectorAll("[data-icon]").forEach((el) => {
      el.innerHTML = icon(el.dataset.icon);
    });
  }
  function syncUrl() {
    try {
      const query = M.toUrl(state);
      history.replaceState(
        null,
        "",
        `${location.pathname}${query ? `?${query}` : ""}${location.hash}`,
      );
    } catch (_) {
      /* Reading local files may disallow history updates. */
    }
  }
  function syncControls() {
    $("clearSearchBtn").hidden = state.search.length === 0;
    for (const [id, key] of Object.entries({
      searchInput: "search",
      moduleFilter: "module",
      severityFilter: "severity",
      culpritFilter: "culprit",
      sortSelect: "sort",
      pageSizeSelect: "pageSize",
    }))
      $(id).value = state[key];
    document.querySelectorAll("[data-status-filter]").forEach((button) =>
      button.setAttribute(
        "aria-pressed",
        String(state.statuses.includes(button.dataset.statusFilter)),
      ),
    );
    document.querySelectorAll("[data-type]").forEach((input) => {
      input.checked =
        state.types === null || state.types.includes(input.dataset.type);
    });
    document
      .querySelectorAll("[data-view]")
      .forEach((button) =>
        button.setAttribute(
          "aria-pressed",
          String(button.dataset.view === state.view),
        ),
      );
    document.querySelectorAll("[data-preset]").forEach((button) => {
      const preset = button.dataset.preset;
      const openSelected =
        state.statuses.length === 2 &&
        state.statuses.includes("pending") &&
        state.statuses.includes("in_progress");
      const active =
        preset === "critical"
          ? openSelected && state.severity === "Critical"
          : preset === "high"
            ? openSelected && state.severity === "High"
          : preset === "open"
            ? openSelected && state.severity === "all"
            : preset === "all"
              ? state.statuses.length === 0 && state.severity === "all"
            : state.statuses.length === 1 &&
              state.statuses[0] === preset &&
              state.severity === "all";
      button.setAttribute("aria-pressed", String(active));
    });
  }
  function renderStats() {
    // Metrics retain their module/platform scope; progress follows every active filter.
    const scoped = M.scope(tasks, state),
      stats = M.stats(scoped),
      completionTasks = M.filter(tasks, state),
      completionStats = M.stats(completionTasks);
    for (const [id, key] of Object.entries({
      statTotal: "total",
      statOpen: "open",
      statCritical: "critical",
      statHigh: "high",
      statInProgress: "in_progress",
    }))
      $(id).textContent = stats[key];
    const percent = completionStats.completionTotal
      ? Math.round((completionStats.done / completionStats.completionTotal) * 100)
      : 0;
    $("completionValue").textContent =
      `${completionStats.done} / ${completionStats.completionTotal}`;
    $("completionCaption").textContent =
      `${completionStats.done} محلولة من ${completionStats.completionTotal} قابلة للإنجاز ضمن الفلاتر الحالية`;
    $("completionProgress").setAttribute("aria-valuenow", percent);
    $("completionProgress").setAttribute(
      "aria-valuetext",
      $("completionCaption").textContent,
    );
    $("completionProgress").firstElementChild.style.width = `${percent}%`;
    for (const [selector, value] of [
      [".priority-critical", stats.critical],
      [".priority-high", stats.high],
    ])
      document.querySelector(selector).dataset.empty = String(value === 0);
  }
  function filterLabels() {
    const labels = [];
    if (state.search.trim())
      labels.push(["search", `بحث: ${state.search.trim()}`]);
    if (state.module !== "all")
      labels.push([
        "module",
        tasks.find((t) => t.moduleId === state.module)?.moduleName ||
          state.module,
      ]);
    if (state.statuses.length)
      labels.push([
        "statuses",
        state.statuses.length === 1
          ? M.STATUSES[state.statuses[0]]
          : `${state.statuses.length} حالات محددة`,
      ]);
    if (state.severity !== "all")
      labels.push(["severity", `الأهمية: ${M.SEVERITIES[state.severity]}`]);
    if (state.culprit !== "all")
      labels.push(["culprit", platformNames[state.culprit]]);
    if (state.types !== null)
      labels.push([
        "types",
        !state.types.length
          ? "لم يتم اختيار نوع"
          : state.types.length === 1
            ? M.TYPES[state.types[0]] || state.types[0]
            : `${state.types.length} أنواع محددة`,
      ]);
    return labels;
  }
  function renderFilters() {
    const labels = filterLabels();
    const resultCount = M.filter(tasks, state).length;
    $("resultsSummary").textContent = labels.length
      ? `عرض ${resultCount} من أصل ${tasks.length} مشكلة`
      : `${tasks.length} مشكلة`;
    $("activeFiltersBar").hidden = labels.length === 0;
    $("activeFilters").innerHTML = labels
      .map(
        ([key, label]) =>
          `<button class="filter-chip" type="button" data-remove-filter="${key}" aria-label="إزالة فلتر ${esc(label)}"><span>${esc(label)}</span>${icon("close")}</button>`,
      )
      .join("");
    const advanced = labels.filter(
      ([key]) => !["search", "module", "statuses"].includes(key),
    ).length;
    $("filterBadge").textContent = advanced;
    $("filterBadge").hidden = !advanced;
    renderModuleOptions();
  }
  function renderModuleOptions() {
    const available = M.filter(tasks, { ...state, module: "all" });
    const counts = new Map(modules.map(([id]) => [id, 0]));
    available.forEach((task) =>
      counts.set(task.moduleId, (counts.get(task.moduleId) || 0) + 1),
    );
    $("moduleFilter").innerHTML =
      `<option value="all">كل الوحدات (${available.length})</option>` +
      modules
        .map(
          ([id, name]) =>
            `<option value="${esc(id)}">${esc(name)} (${counts.get(id) || 0})</option>`,
        )
        .join("");
  }
  function severity(task) {
    const key = Object.hasOwn(M.SEVERITIES, task.severity)
      ? task.severity.toLowerCase()
      : "unknown";
    const bars =
      task.severity === "Low" ? 1 : task.severity === "Medium" ? 2 : 3;
    return `<span class="severity severity-${key}"><span class="severity-bars" aria-hidden="true">${[1, 2, 3].map((n) => `<i${n > bars ? ' class="inactive"' : ""}></i>`).join("")}</span>${esc(M.SEVERITIES[task.severity] || task.severity || "غير محددة")}</span>`;
  }
  function platform(task) {
    const p = M.platforms(task);
    return p.mobile && p.backend
      ? "الموبايل والخادم"
      : p.backend
        ? "الخادم"
        : p.mobile
          ? "الموبايل"
          : "غير محددة";
  }
  function statusControl(task, context) {
    const busy = saving.has(task.id);
    const visibleStatus = savingTargets.get(task.id) || task.status;
    const statusIcons = {
      pending: "clock",
      in_progress: "activity",
      done: "check",
      archived: "archive",
      cancelled: "cancel",
    };
    const buttons = Object.entries(M.STATUSES)
      .map(
        ([key, label]) =>
          `<button type="button" class="status-option" data-status-id="${esc(task.id)}" data-status-value="${key}" data-focus-key="${esc(`${context}-status-${key}-${task.id}`)}" aria-label="تغيير حالة ${esc(task.id)} إلى ${label}" aria-pressed="${visibleStatus === key}" title="${label}" ${busy ? "disabled" : ""}>${icon(statusIcons[key])}<span class="status-tooltip" aria-hidden="true">${label}</span></button>`,
      )
      .join("");
    const currentLabel = busy
      ? `جارٍ حفظ: ${M.STATUSES[visibleStatus]}`
      : `الحالة: ${M.STATUSES[visibleStatus]}`;
    return `<div class="status-wrap${busy ? " is-saving" : ""}" data-current-status="${esc(visibleStatus)}" aria-busy="${busy}"><div class="status-picker" role="group" aria-label="تغيير حالة المشكلة ${esc(task.id)}">${buttons}</div><span class="current-status-label" role="status">${currentLabel}</span></div>`;
  }
  function titleButton(task, context) {
    return `<button type="button" class="issue-title" data-open-task="${esc(task.id)}" data-focus-key="${esc(`${context}-title-${task.id}`)}">${esc(task.title)}</button>`;
  }
  function listRow(task, index) {
    return `<tr class="issue-row" data-open-task="${esc(task.id)}"><td class="issue-index-cell"><span class="issue-index mono">${index}</span></td><td><div class="issue-identity"><bdi class="issue-id">${esc(task.id)}</bdi><button type="button" class="icon-button inline-copy" data-copy-value="${esc(task.id)}" aria-label="نسخ كود المشكلة ${esc(task.id)}" title="نسخ الكود">${icon("copy")}</button><span class="issue-types">${task.types.map((k) => esc(M.TYPES[k] || k)).join(" · ")}</span></div>${titleButton(task, "list")}</td><td>${severity(task)}</td><td><bdi class="module-name">${esc(task.moduleName)}</bdi></td><td>${statusControl(task, "list")}</td></tr>`;
  }
  function inlineText(value) {
    return value
      .split(/(`[^`\n]+`)/g)
      .map((part) =>
        part.startsWith("`") && part.endsWith("`")
          ? `<code dir="ltr">${esc(part.slice(1, -1))}</code>`
          : esc(part),
      )
      .join("");
  }
  function prose(value) {
    return value
      .trim()
      .split(/\n\s*\n/)
      .filter(Boolean)
      .map((paragraph) => `<p>${inlineText(paragraph)}</p>`)
      .join("");
  }
  function richText(value) {
    if (!value.trim())
      return '<p class="muted">لم تُضف تفاصيل لهذا القسم بعد.</p>';
    // Escape source data before adding markup. Fenced code is never interpreted as HTML.
    const pattern = /```([^\n`]*)\n([\s\S]*?)```/g;
    let result = "",
      cursor = 0,
      match;
    while ((match = pattern.exec(value))) {
      result += prose(value.slice(cursor, match.index));
      const codeId = `code-${++codeSequence}`;
      result += `<div class="code-block"><div class="code-toolbar"><span>${esc(match[1].trim() || "CODE")}</span><button type="button" class="button subtle" data-copy-target="${codeId}" aria-label="نسخ الكود">${icon("copy")}نسخ الكود</button></div><pre tabindex="0" aria-label="الكود المقترح"><code id="${codeId}">${esc(match[2].replace(/\n$/, ""))}</code></pre></div>`;
      cursor = pattern.lastIndex;
    }
    return result + prose(value.slice(cursor));
  }
  function fileReference(task) {
    return `<div class="file-reference" aria-label="مسار ملف المشكلة"><span class="file-reference-icon">${icon("document")}</span><div class="file-copy-group"><code dir="ltr">${esc(task.file || "لم يُحدد ملف")}</code>${task.file ? `<button type="button" class="icon-button copy-button" data-copy-file="${esc(task.id)}" aria-label="نسخ مسار الملف" title="نسخ مسار الملف">${icon("copy")}</button>` : ""}</div></div>`;
  }
  function moduleBadge(task) {
    return `<span class="module-badge"><span class="module-kicker">الوحدة</span><bdi>${esc(task.moduleName)}</bdi></span>`;
  }
  function section(number, title, content) {
    return `<section class="detail-section"><h3><span class="section-index" aria-hidden="true">${number}</span>${title}</h3><div class="rich-text">${richText(content)}</div></section>`;
  }
  function reportCard(task) {
    const collapsed = collapsedReports.has(task.id);
    const toggle = `<button type="button" class="icon-button report-toggle" data-toggle-report="${esc(task.id)}" data-focus-key="report-toggle-${esc(task.id)}" aria-expanded="${!collapsed}" aria-label="${collapsed ? "توسيع" : "طي"} المشكلة ${esc(task.id)}" title="${collapsed ? "عرض التفاصيل" : "طي التفاصيل"}">${icon("chevron")}</button>`;
    if (collapsed)
      return `<article class="report-card is-collapsed"><div class="report-compact-row">${toggle}<div class="report-compact-main"><div class="issue-identity"><bdi class="issue-id">${esc(task.id)}</bdi><button type="button" class="icon-button inline-copy" data-copy-value="${esc(task.id)}" aria-label="نسخ كود المشكلة ${esc(task.id)}" title="نسخ الكود">${icon("copy")}</button><span class="issue-types">${task.types.map((k) => esc(M.TYPES[k] || k)).join(" · ")}</span></div>${titleButton(task, "report")}</div><div class="report-compact-severity">${severity(task)}</div><div class="report-compact-module"><bdi class="module-name">${esc(task.moduleName)}</bdi><span class="platform-label">${platform(task)}</span></div><div class="report-compact-status">${statusControl(task, "report")}</div></div></article>`;
    return `<article class="report-card"><header class="report-card-header"><div class="report-topline">${toggle}<bdi class="issue-id">${esc(task.id)}</bdi><button type="button" class="icon-button inline-copy" data-copy-value="${esc(task.id)}" aria-label="نسخ كود المشكلة ${esc(task.id)}" title="نسخ الكود">${icon("copy")}</button>${severity(task)}${statusControl(task, "report")}</div>${titleButton(task, "report")}<div class="platform-label">${esc(task.moduleName)} · ${platform(task)} · ${task.types.map((k) => esc(M.TYPES[k] || k)).join(" · ")}</div></header><div class="report-card-body">${fileReference(task)}<div class="report-columns">${section("01", "التجربة والأثر", task.testScenario)}${section("02", "التحليل التقني", task.technicalAnalysis)}</div>${section("03", "الحل المقترح", task.solution)}</div></article>`;
  }
  function boardCard(task) {
    const busy = saving.has(task.id);
    const visibleStatus = savingTargets.get(task.id) || task.status;
    const options = Object.entries(M.STATUSES)
      .map(
        ([key, label]) =>
          `<option value="${key}" ${visibleStatus === key ? "selected" : ""}>${label}</option>`,
      )
      .join("");
    return `<article class="board-card${busy ? " is-saving" : ""}" draggable="${!busy}" data-board-task="${esc(task.id)}" data-focus-key="board-card-${esc(task.id)}" aria-busy="${busy}"><div class="board-card-top"><bdi class="issue-id">${esc(task.id)}</bdi><span class="board-drag-handle" aria-hidden="true" title="اسحب لنقل المهمة">${icon("grip")}</span></div><button type="button" class="board-card-title" data-open-task="${esc(task.id)}" data-focus-key="board-title-${esc(task.id)}">${esc(task.title)}</button><div class="board-card-footer">${severity(task)}<label class="board-move"><span class="sr-only">نقل ${esc(task.id)} إلى حالة أخرى</span><select data-board-move-id="${esc(task.id)}" aria-label="نقل ${esc(task.id)} إلى حالة أخرى" ${busy ? "disabled" : ""}>${options}</select></label></div></article>`;
  }
  function boardColumn(status, label) {
    const items = filtered.filter(
      (task) => (savingTargets.get(task.id) || task.status) === status,
    );
    return `<section class="board-column board-column-${status}" data-board-status="${status}" aria-labelledby="board-heading-${status}"><header class="board-column-header"><h3 id="board-heading-${status}">${label}</h3><span class="board-count mono" aria-label="${items.length} مهام">${items.length}</span></header><div class="board-column-body">${items.length ? items.map(boardCard).join("") : '<div class="board-empty"><span>لا توجد مهام</span><small>اسحب مهمة إلى هنا</small></div>'}</div></section>`;
  }
  function renderBoard() {
    return `<div class="board-shell"><p class="sr-only" id="boardHelp">يمكن سحب المهام بين الأعمدة، أو استخدام قائمة نقل الحالة داخل كل بطاقة.</p><div class="kanban-board" aria-label="لوحة حالات المهام" aria-describedby="boardHelp">${Object.entries(M.STATUSES).map(([status, label]) => boardColumn(status, label)).join("")}</div></div>`;
  }
  function pageTokens(current, pages) {
    if (pages <= 7) return Array.from({ length: pages }, (_, index) => index + 1);
    if (current <= 4) return [1, 2, 3, 4, 5, "end-gap", pages];
    if (current >= pages - 3)
      return [1, "start-gap", pages - 4, pages - 3, pages - 2, pages - 1, pages];
    return [1, "start-gap", current - 1, current, current + 1, "end-gap", pages];
  }
  function renderPageNumbers(page) {
    $("pageNumbers").innerHTML = pageTokens(page.page, page.pages)
      .map((token) =>
        typeof token === "number"
          ? `<button type="button" class="page-number" data-page="${token}" ${token === page.page ? 'aria-current="page"' : ""} aria-label="الصفحة ${token}">${token}</button>`
          : '<span class="page-ellipsis" aria-hidden="true">…</span>',
      )
      .join("");
  }
  function renderResults() {
    filtered = M.sort(M.filter(tasks, state), state.sort);
    const page = M.paginate(filtered, state.page, state.pageSize);
    state.page = page.page;
    if (!filtered.length) {
      const hasData = tasks.length > 0;
      $("results").innerHTML =
        `<div class="empty-state"><span class="empty-symbol">${icon(hasData ? "search" : "layers")}</span><h3>${hasData ? "لا توجد مشاكل تطابق اختياراتك" : "سجل الجودة جاهز لأول فحص"}</h3><p>${hasData ? "جرّب كلمات بحث أقصر أو أزل بعض الفلاتر لعرض نتائج أكثر." : "ستظهر المشاكل هنا بعد إضافة نتائج تدقيق المشروع."}</p>${hasData ? '<button type="button" class="button primary" data-action="reset">مسح الفلاتر وعرض الكل</button>' : '<button type="button" class="button" data-action="refresh">تحديث البيانات</button>'}</div>`;
    } else if (state.view === "board") {
      $("results").innerHTML = renderBoard();
    } else if (state.view === "report") {
      $("results").innerHTML =
        `<div class="report-list">${page.items.map(reportCard).join("")}</div>`;
    } else {
      const offset = (page.page - 1) * page.pageSize;
      $("results").innerHTML =
        `<table class="issue-table"><caption class="sr-only">مشاكل المشروع، مرتبة حسب الاختيار الحالي</caption><thead><tr><th class="issue-index-heading" scope="col">#</th><th scope="col">المشكلة</th><th scope="col">الأهمية</th><th scope="col">الوحدة</th><th scope="col">الحالة</th></tr></thead><tbody>${page.items.map((task, index) => listRow(task, offset + index)).join("")}</tbody></table>`;
    }
    $("pagination").hidden = state.view === "board" || page.total <= M.PAGE_SIZE;
    $("pageInfo").textContent =
      `صفحة ${page.page} من ${page.pages}، ${page.pageSize} مشكلة في الصفحة`;
    renderPageNumbers(page);
    $("prevPageBtn").disabled = page.page <= 1;
    $("nextPageBtn").disabled = page.page >= page.pages;
  }
  function focusKey(key) {
    return [...document.querySelectorAll("[data-focus-key]")].find(
      (el) => el.dataset.focusKey === key,
    );
  }
  function render() {
    const focused = document.activeElement;
    const key = focused?.dataset.focusKey;
    const removedFilter = focused?.dataset.removeFilter;
    renderStats();
    renderFilters();
    renderResults();
    syncControls();
    syncUrl();
    if ($("taskDialog").open) renderDetail(false);
    if (key) {
      const target = focusKey(key);
      if (target && !target.disabled) target.focus({ preventScroll: true });
      else if (!$("taskDialog").open)
        $("resultsHeading").focus({ preventScroll: true });
    } else if (removedFilter && !focused.isConnected)
      $("searchInput").focus({ preventScroll: true });
  }
  function changeFilters(patch) {
    Object.assign(state, patch, { page: 1 });
    render();
  }
  function resetFilters() {
    const { view, sort, pageSize, task } = state;
    state = { ...M.defaults(), view, sort, pageSize, task };
    render();
    $("searchInput").focus({ preventScroll: true });
  }
  function renderDetail(resetScroll) {
    const task = tasks.find((t) => t.id === state.task);
    if (!task) return;
    const content = $("detailContent"),
      scroll = content.scrollTop;
    const index = filtered.findIndex((t) => t.id === task.id);
    $("detailHeaderMeta").innerHTML =
      `<div class="dialog-id"><bdi class="mono">${esc(task.id)}</bdi><button type="button" class="icon-button copy-button" data-copy-value="${esc(task.id)}" aria-label="نسخ كود المشكلة ${esc(task.id)}" title="نسخ كود المشكلة">${icon("copy")}</button></div>${severity(task)}${statusControl(task, "detail")}`;
    content.innerHTML = `${index < 0 ? '<p class="dialog-note">هذه المشكلة خارج التصفية الحالية. يمكنك إكمال مراجعتها هنا.</p>' : ""}<h2 class="detail-title" id="detailTitle">${esc(task.title)}</h2><div class="detail-meta">${moduleBadge(task)}<span class="neutral-tag">${platform(task)}</span>${task.types.map((k) => `<span class="neutral-tag">${esc(M.TYPES[k] || k)}</span>`).join("")}</div>${fileReference(task)}${section("01", "خطوات التجربة والأثر", task.testScenario)}${section("02", "التحليل وجذر المشكلة", task.technicalAnalysis)}${section("03", "الحل المقترح", task.solution)}`;
    content.scrollTop = resetScroll ? 0 : scroll;
    $("detailPosition").textContent =
      index >= 0
        ? `${index + 1} من ${filtered.length} في النتائج الحالية`
        : "خارج النتائج الحالية";
    $("prevTaskBtn").disabled = index <= 0;
    $("nextTaskBtn").disabled = index < 0 || index >= filtered.length - 1;
  }
  function openTask(id, trigger) {
    if (!tasks.some((t) => t.id === id)) return;
    state.task = id;
    if (trigger) returnFocusKey = trigger.dataset.focusKey || "";
    renderDetail(true);
    const dialog = $("taskDialog");
    if (!dialog.open) {
      // Keep feedback inside the dialog's top layer while it is open.
      dialog.appendChild($("toast"));
      dialog.showModal();
    }
    $("closeDetailBtn").focus({ preventScroll: true });
    syncUrl();
  }
  function closeTask() {
    if ($("taskDialog").open) $("taskDialog").close();
  }
  function moveTask(step) {
    const index = filtered.findIndex((t) => t.id === state.task);
    if (index >= 0 && filtered[index + step])
      openTask(filtered[index + step].id);
  }
  function showToast(message, tone = "success", action) {
    clearTimeout(toastTimer);
    $("toastMessage").textContent = message;
    $("toast").dataset.tone = tone;
    $("toastIcon").innerHTML = icon(tone === "error" ? "alert" : "check");
    $("toast").hidden = false;
    $("toastAction").hidden = !action;
    toastAction = action;
    // Errors and undo opportunities remain until dismissed or replaced.
    if (tone !== "error" && !action)
      toastTimer = setTimeout(dismissToast, 5500);
  }
  function dismissToast() {
    clearTimeout(toastTimer);
    const heldFocus = $("toast").contains(document.activeElement);
    $("toast").hidden = true;
    toastAction = null;
    if (heldFocus)
      ($("taskDialog").open ? $("closeDetailBtn") : $("resultsHeading")).focus({
        preventScroll: true,
      });
  }
  async function setStatus(id, newStatus, allowUndo = true) {
    const task = tasks.find((t) => t.id === id);
    if (!task || saving.has(id) || task.status === newStatus) return;
    const previous = task.status;
    const focusedKey = document.activeElement?.dataset.focusKey;
    saving.add(id);
    savingTargets.set(id, newStatus);
    render();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      if (location.protocol === "file:") throw new Error("local-file");
      await M.persistStatus(task, newStatus, (url, options) =>
        fetch(url, { ...options, signal: controller.signal }),
      );
      showToast(
        `تم حفظ حالة ${id}: ${M.STATUSES[newStatus]}.`,
        "success",
        allowUndo
          ? () => {
              if (task.status !== newStatus)
                return showToast(
                  "تغيرت الحالة منذ آخر حفظ. راجع الحالة الحالية قبل التعديل.",
                  "error",
                );
              return setStatus(id, previous, false);
            }
          : null,
      );
    } catch (error) {
      const message =
        error.name === "AbortError"
          ? "لم يصل تأكيد الحفظ. حدّث البيانات للتحقق من الحالة قبل المحاولة مرة أخرى."
          : "تعذر تأكيد حفظ الحالة. تأكد من تشغيل run.bat، ثم حدّث البيانات وأعد المحاولة.";
      showToast(message, "error");
    } finally {
      clearTimeout(timeout);
      saving.delete(id);
      savingTargets.delete(id);
      render();
      if (focusedKey && focusKey(focusedKey) && !focusKey(focusedKey).disabled)
        focusKey(focusedKey).focus({ preventScroll: true });
    }
  }
  function confirmCopy(button) {
    if (!button) return;
    const previous = copyFeedback.get(button);
    if (previous) clearTimeout(previous.timer);
    const original = previous?.html ?? button.innerHTML;
    const originalLabel = previous?.label ?? button.getAttribute("aria-label");
    button.classList.add("copy-confirmed");
    button.innerHTML = `${icon("check")}${button.classList.contains("copy-button") || button.classList.contains("icon-button") ? "" : "تم"}`;
    button.setAttribute("aria-label", "تم النسخ");
    const timer = setTimeout(() => {
      if (!button.isConnected) return;
      button.innerHTML = original;
      button.classList.remove("copy-confirmed");
      if (originalLabel) button.setAttribute("aria-label", originalLabel);
      copyFeedback.delete(button);
    }, 500);
    copyFeedback.set(button, { html: original, label: originalLabel, timer });
  }
  async function copyText(text, button) {
    try {
      await navigator.clipboard.writeText(text);
      confirmCopy(button);
    } catch (_) {
      showToast("تعذر النسخ تلقائيًا. حدد النص وانسخه يدويًا.", "error");
    }
  }
  function updateThemeButton() {
    const dark = document.documentElement.dataset.theme === "dark";
    const label = dark ? "تفعيل الوضع الفاتح" : "تفعيل الوضع الداكن";
    $("themeToggleBtn").innerHTML = icon(dark ? "sun" : "moon");
    $("themeToggleBtn").setAttribute("aria-label", label);
    $("themeToggleBtn").title = label;
    document.querySelector('meta[name="theme-color"]').content = dark
      ? "#020617"
      : "#f1f5f9";
  }
  function refresh() {
    if (saving.size)
      return showToast("انتظر اكتمال حفظ الحالة قبل تحديث البيانات.", "error");
    syncUrl();
    $("refreshBtn").classList.add("refreshing");
    location.reload();
  }
  function closeFilters(restoreFocus = true) {
    $("filterPanel").open = false;
    if (restoreFocus) $("filterPanel").querySelector("summary").focus();
  }
  function drawerLimits() {
    const max = Math.max(
      MIN_DRAWER_WIDTH,
      Math.min(MAX_DRAWER_WIDTH, window.innerWidth - 64),
    );
    return { min: Math.min(MIN_DRAWER_WIDTH, max), max };
  }
  function renderDrawerWidth() {
    const { min, max } = drawerLimits();
    const width = Math.min(max, Math.max(min, preferredDrawerWidth));
    $("taskDialog").style.setProperty("--drawer-width", `${width}px`);
    $("drawerResizeHandle").setAttribute("aria-valuemin", min);
    $("drawerResizeHandle").setAttribute("aria-valuemax", max);
    $("drawerResizeHandle").setAttribute("aria-valuenow", width);
  }
  function setDrawerWidth(width, persist = false) {
    const { min, max } = drawerLimits();
    preferredDrawerWidth = Math.min(max, Math.max(min, Math.round(width)));
    renderDrawerWidth();
    if (persist) {
      try {
        localStorage.setItem(DRAWER_WIDTH_KEY, preferredDrawerWidth);
      } catch (_) {
        /* Resizing still works for the current session. */
      }
    }
  }
  function initDrawerResize() {
    try {
      const saved = Number(localStorage.getItem(DRAWER_WIDTH_KEY));
      if (Number.isFinite(saved) && saved >= MIN_DRAWER_WIDTH)
        preferredDrawerWidth = Math.min(MAX_DRAWER_WIDTH, saved);
    } catch (_) {
      /* Use the default drawer width. */
    }
    renderDrawerWidth();
    const handle = $("drawerResizeHandle");
    let dragging = false;
    const finishResize = (event) => {
      if (!dragging) return;
      dragging = false;
      document.body.classList.remove("drawer-resizing");
      try {
        handle.releasePointerCapture?.(event.pointerId);
      } catch (_) {
        /* Pointer capture may already be released. */
      }
      setDrawerWidth(preferredDrawerWidth, true);
    };
    handle.addEventListener("pointerdown", (event) => {
      if (window.innerWidth <= 760 || event.button !== 0) return;
      dragging = true;
      document.body.classList.add("drawer-resizing");
      handle.setPointerCapture?.(event.pointerId);
      event.preventDefault();
    });
    handle.addEventListener("pointermove", (event) => {
      if (!dragging) return;
      setDrawerWidth(window.innerWidth - event.clientX);
    });
    handle.addEventListener("pointerup", finishResize);
    handle.addEventListener("pointercancel", finishResize);
    handle.addEventListener("dblclick", () =>
      setDrawerWidth(DEFAULT_DRAWER_WIDTH, true),
    );
    handle.addEventListener("keydown", (event) => {
      const { min, max } = drawerLimits();
      let next = preferredDrawerWidth;
      if (event.key === "ArrowLeft") next += 24;
      else if (event.key === "ArrowRight") next -= 24;
      else if (event.key === "Home") next = min;
      else if (event.key === "End") next = max;
      else return;
      event.preventDefault();
      setDrawerWidth(next, true);
    });
    window.addEventListener("resize", renderDrawerWidth);
  }

  // Initial controls use native inputs for keyboard and assistive-technology support.
  const modules = [...new Map(tasks.map((t) => [t.moduleId, t.moduleName]))];
  $("typeOptions").innerHTML = types
    .map(
      (key) =>
        `<label class="type-option"><input type="checkbox" data-type="${esc(key)}" checked><span>${esc(M.TYPES[key] || key)}</span></label>`,
    )
    .join("");
  const project = $("projectName");
  if (project.textContent.includes("{{PROJECT_NAME}}")) {
    project.textContent = "قالب تجريبي";
    document.title = "مِعيار — قالب ضمان الجودة";
    $("dataNote").textContent = "بيانات توضيحية · جاهز لنتائج مشروعك";
  }
  if (location.protocol === "file:")
    $("dataNote").textContent = "للحفظ المباشر، افتح اللوحة عبر run.bat";
  fillIcons();
  updateThemeButton();
  initDrawerResize();
  render();
  if (state.task) openTask(state.task);

  $("searchInput").addEventListener("input", (event) =>
    changeFilters({ search: event.target.value }),
  );
  $("clearSearchBtn").addEventListener("click", () => {
    changeFilters({ search: "" });
    $("searchInput").focus({ preventScroll: true });
  });
  for (const [id, key] of Object.entries({
    moduleFilter: "module",
    severityFilter: "severity",
    culpritFilter: "culprit",
    sortSelect: "sort",
  })) {
    $(id).addEventListener("change", (event) =>
      changeFilters({ [key]: event.target.value }),
    );
  }
  $("pageSizeSelect").addEventListener("change", (event) =>
    changeFilters({ pageSize: Number(event.target.value) }),
  );
  $("typeOptions").addEventListener("change", () => {
    const selected = [
      ...$("typeOptions").querySelectorAll("input:checked"),
    ].map((input) => input.dataset.type);
    changeFilters({
      types: selected.length === types.length ? null : selected,
    });
  });
  $("results").addEventListener("change", (event) => {
    const select = event.target.closest("[data-board-move-id]");
    if (select) setStatus(select.dataset.boardMoveId, select.value);
  });
  $("results").addEventListener("dragstart", (event) => {
    const card = event.target.closest("[data-board-task]");
    if (!card || card.getAttribute("draggable") !== "true") return;
    draggedTaskId = card.dataset.boardTask;
    card.classList.add("is-dragging");
    event.dataTransfer?.setData("text/plain", draggedTaskId);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
  });
  $("results").addEventListener("dragover", (event) => {
    const column = event.target.closest("[data-board-status]");
    if (!column || !draggedTaskId) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    document.querySelectorAll(".board-column.is-drop-target").forEach((item) =>
      item.classList.remove("is-drop-target"),
    );
    column.classList.add("is-drop-target");
  });
  $("results").addEventListener("dragleave", (event) => {
    const column = event.target.closest("[data-board-status]");
    if (column && !column.contains(event.relatedTarget))
      column.classList.remove("is-drop-target");
  });
  $("results").addEventListener("drop", (event) => {
    const column = event.target.closest("[data-board-status]");
    if (!column || !draggedTaskId) return;
    event.preventDefault();
    const id = draggedTaskId;
    draggedTaskId = "";
    column.classList.remove("is-drop-target");
    setStatus(id, column.dataset.boardStatus);
  });
  $("results").addEventListener("dragend", () => {
    draggedTaskId = "";
    document.querySelectorAll(".board-column.is-drop-target").forEach((item) =>
      item.classList.remove("is-drop-target"),
    );
    document.querySelector(".board-card.is-dragging")?.classList.remove("is-dragging");
  });
  $("allTypesBtn").addEventListener("click", () =>
    changeFilters({ types: null }),
  );
  $("noTypesBtn").addEventListener("click", () => changeFilters({ types: [] }));
  $("closeFiltersBtn").addEventListener("click", () => closeFilters());
  $("themeToggleBtn").addEventListener("click", () => {
    const theme =
      document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("qa_theme", theme);
    } catch (_) {
      /* Session theme still works. */
    }
    updateThemeButton();
  });
  $("refreshBtn").addEventListener("click", refresh);
  for (const [id, step] of [
    ["prevPageBtn", -1],
    ["nextPageBtn", 1],
  ]) {
    $(id).addEventListener("click", () => {
      state.page += step;
      render();
      $("resultsHeading").focus({ preventScroll: true });
      $("resultsHeading").scrollIntoView({ block: "start", behavior: "auto" });
    });
  }
  $("closeDetailBtn").addEventListener("click", closeTask);
  $("prevTaskBtn").addEventListener("click", () => moveTask(-1));
  $("nextTaskBtn").addEventListener("click", () => moveTask(1));
  $("taskDialog").addEventListener("close", () => {
    state.task = "";
    document.body.appendChild($("toast"));
    syncUrl();
    (focusKey(returnFocusKey) || $("resultsHeading")).focus({
      preventScroll: true,
    });
  });
  $("taskDialog").addEventListener("click", (event) => {
    if (event.target !== $("taskDialog")) return;
    const rect = $("taskDialog").getBoundingClientRect();
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    )
      closeTask();
  });
  $("dismissToastBtn").addEventListener("click", dismissToast);
  $("toastAction").addEventListener("click", () => {
    const action = toastAction;
    dismissToast();
    if (action) action();
  });
  document.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!$("filterPanel").contains(event.target)) closeFilters(false);
    if (button) {
      if (button.dataset.toggleReport !== undefined) {
        const id = button.dataset.toggleReport;
        if (collapsedReports.has(id)) collapsedReports.delete(id);
        else collapsedReports.add(id);
        render();
      } else if (button.dataset.page !== undefined) {
        state.page = Number(button.dataset.page);
        render();
        $("resultsHeading").focus({ preventScroll: true });
        $("resultsHeading").scrollIntoView({ block: "start", behavior: "auto" });
      } else if (button.dataset.statusFilter !== undefined) {
        const selected = button.dataset.statusFilter;
        changeFilters({
          statuses: state.statuses.includes(selected)
            ? state.statuses.filter((status) => status !== selected)
            : [...state.statuses, selected],
        });
      } else if (button.dataset.statusValue !== undefined)
        setStatus(button.dataset.statusId, button.dataset.statusValue);
      else if (button.dataset.openTask !== undefined)
        openTask(button.dataset.openTask, button);
      else if (button.dataset.copyTarget)
        copyText($(button.dataset.copyTarget)?.textContent || "", button);
      else if (button.dataset.copyFile !== undefined)
        copyText(
          tasks.find((t) => t.id === button.dataset.copyFile)?.file || "",
          button,
        );
      else if (button.dataset.copyValue !== undefined)
        copyText(button.dataset.copyValue, button);
      else if (button.dataset.action === "reset") resetFilters();
      else if (button.dataset.action === "refresh") refresh();
      else if (button.dataset.removeFilter)
        changeFilters({
          [button.dataset.removeFilter]:
            M.defaults()[button.dataset.removeFilter],
        });
      else if (button.dataset.view) {
        state.view = button.dataset.view;
        render();
      } else if (button.dataset.preset) {
        const preset = button.dataset.preset;
        const active = button.getAttribute("aria-pressed") === "true";
        // A metric opens exactly its counted set, preserving only module/platform scope.
        changeFilters({
          statuses: active
            ? []
            : preset === "critical" || preset === "high" || preset === "open"
              ? ["pending", "in_progress"]
              : preset === "all"
                ? []
                : [preset],
          severity:
            !active && preset === "critical"
              ? "Critical"
              : !active && preset === "high"
                ? "High"
                : "all",
          search: "",
          types: null,
        });
      }
      return;
    }
    const row = event.target.closest(".issue-row[data-open-task]");
    if (row) openTask(row.dataset.openTask, row.querySelector(".issue-title"));
  });
  document.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      $("filterPanel").open &&
      !$("taskDialog").open
    ) {
      event.preventDefault();
      closeFilters();
    }
    if (
      event.key === "/" &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey &&
      !$("taskDialog").open &&
      !event.target.matches("input,textarea,select") &&
      !event.target.isContentEditable
    ) {
      event.preventDefault();
      $("searchInput").focus();
    }
  });
  window.addEventListener("popstate", () => {
    const next = M.fromUrl(location.search, tasks);
    if (!next.task && $("taskDialog").open) closeTask();
    state = next;
    render();
    if (state.task) openTask(state.task);
  });
})();
