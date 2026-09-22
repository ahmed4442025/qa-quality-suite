/* Miyar PM report. Read-only by design; filters never mutate finding data. */
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
  const modules = [...new Map(tasks.map((task) => [task.moduleId, task.moduleName]))];
  let state = M.fromUrl(location.search, tasks);
  let filtered = [];
  let returnFocusKey = "";
  const collapsedReports = new Set();

  const DRAWER_WIDTH_KEY = "qa_report_drawer_width";
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
  const severityNames = { ...M.SEVERITIES, Priority: "حرجة وعالية" };
  const statusIcons = {
    pending: "clock",
    in_progress: "activity",
    done: "check",
    archived: "archive",
    cancelled: "cancel",
  };
  const icons = {
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/>',
    filter: '<path d="M4 7h16M7 12h10M10 17h4"/>',
    sort: '<path d="M8 6h10M8 12h7M8 18h4M4 6h.01M4 12h.01M4 18h.01"/>',
    chevron: '<path d="m7 10 5 5 5-5"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    arrow: '<path d="M19 12H5m6-6-6 6 6 6"/>',
    "arrow-right": '<path d="M5 12h14m-6-6 6 6-6 6"/>',
    moon: '<path d="M20.5 14a8.6 8.6 0 0 1-10.6-10.5A8.8 8.8 0 1 0 20.5 14Z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
    eye: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5"/>',
    alert: '<path d="m12 3 10 18H2L12 3Zm0 6v5m0 3h.01"/>',
    activity: '<path d="M2 12h5l3-8 4 16 3-8h5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    archive: '<path d="M4 7h16v13H4V7Zm-1-4h18v4H3V3Zm7 8h4"/>',
    cancel: '<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6m0-6-6 6"/>',
    list: '<path d="M9 6h12M9 12h12M9 18h12M3 6h.01M3 12h.01M3 18h.01"/>',
    document: '<path d="M14 2H5v20h14V7l-5-5Zm0 0v5h5M8 12h8M8 16h8"/>',
  };

  function icon(name) {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.document}</svg>`;
  }

  function fillIcons(root = document) {
    root.querySelectorAll("[data-icon]").forEach((element) => {
      element.innerHTML = icon(element.dataset.icon);
    });
  }

  function syncUrl() {
    try {
      const query = M.toUrl(state);
      history.replaceState(null, "", `${location.pathname}${query ? `?${query}` : ""}${location.hash}`);
    } catch (_) {
      /* Local file viewers may disallow history updates. */
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
    })) {
      $(id).value = state[key];
    }
    document.querySelectorAll("[data-status-filter]").forEach((button) => {
      button.setAttribute("aria-pressed", String(state.statuses.includes(button.dataset.statusFilter)));
    });
    document.querySelectorAll("[data-type]").forEach((input) => {
      input.checked = state.types === null || state.types.includes(input.dataset.type);
    });
    document.querySelectorAll("[data-view]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.view === state.view));
    });
    document.querySelectorAll("[data-preset]").forEach((button) => {
      const preset = button.dataset.preset;
      const openSelected =
        state.statuses.length === 2 &&
        state.statuses.includes("pending") &&
        state.statuses.includes("in_progress");
      const active =
        preset === "priority"
          ? openSelected && state.severity === "Priority"
          : preset === "open"
            ? openSelected && state.severity === "all"
            : preset === "all"
              ? state.statuses.length === 0 && state.severity === "all"
              : state.statuses.length === 1 && state.statuses[0] === preset && state.severity === "all";
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function renderStats() {
    const scoped = M.scope(tasks, state);
    const stats = M.stats(scoped);
    const completionStats = M.stats(M.filter(tasks, state));
    for (const [id, key] of Object.entries({
      statTotal: "total",
      statOpen: "open",
      statPriority: "priority",
      statDone: "done",
    })) {
      $(id).textContent = stats[key];
    }
    const percent = completionStats.completionTotal
      ? Math.round((completionStats.done / completionStats.completionTotal) * 100)
      : 0;
    $("completionValue").textContent = `${completionStats.done} / ${completionStats.completionTotal}`;
    $("completionCaption").textContent = `${completionStats.done} محلولة من ${completionStats.completionTotal} قابلة للإنجاز ضمن الفلاتر الحالية`;
    $("completionProgress").setAttribute("aria-valuenow", percent);
    $("completionProgress").setAttribute("aria-valuetext", $("completionCaption").textContent);
    $("completionProgress").firstElementChild.style.width = `${percent}%`;
  }

  function filterLabels() {
    const labels = [];
    if (state.search.trim()) labels.push(["search", `بحث: ${state.search.trim()}`]);
    if (state.module !== "all") {
      labels.push(["module", tasks.find((task) => task.moduleId === state.module)?.moduleName || state.module]);
    }
    if (state.statuses.length) {
      labels.push([
        "statuses",
        state.statuses.length === 1 ? M.STATUSES[state.statuses[0]] : `${state.statuses.length} حالات محددة`,
      ]);
    }
    if (state.severity !== "all") labels.push(["severity", `الأهمية: ${severityNames[state.severity]}`]);
    if (state.culprit !== "all") labels.push(["culprit", platformNames[state.culprit]]);
    if (state.types !== null) {
      labels.push([
        "types",
        !state.types.length
          ? "لم يتم اختيار نوع"
          : state.types.length === 1
            ? M.TYPES[state.types[0]] || state.types[0]
            : `${state.types.length} أنواع محددة`,
      ]);
    }
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
      .map(([key, label]) => `<button class="filter-chip" type="button" data-remove-filter="${key}" aria-label="إزالة فلتر ${esc(label)}"><span>${esc(label)}</span>${icon("close")}</button>`)
      .join("");
    const advanced = labels.filter(([key]) => !["search", "module", "statuses"].includes(key)).length;
    $("filterBadge").textContent = advanced;
    $("filterBadge").hidden = advanced === 0;
    renderModuleOptions();
  }

  function renderModuleOptions() {
    const available = M.filter(tasks, { ...state, module: "all" });
    const counts = new Map(modules.map(([id]) => [id, 0]));
    available.forEach((task) => counts.set(task.moduleId, (counts.get(task.moduleId) || 0) + 1));
    $("moduleFilter").innerHTML =
      `<option value="all">كل الوحدات (${available.length})</option>` +
      modules.map(([id, name]) => `<option value="${esc(id)}">${esc(name)} (${counts.get(id) || 0})</option>`).join("");
  }

  function severity(task) {
    const key = Object.hasOwn(M.SEVERITIES, task.severity) ? task.severity.toLowerCase() : "unknown";
    const bars = task.severity === "Low" ? 1 : task.severity === "Medium" ? 2 : 3;
    return `<span class="severity severity-${key}"><span class="severity-bars" aria-hidden="true">${[1, 2, 3].map((number) => `<i${number > bars ? ' class="inactive"' : ""}></i>`).join("")}</span>${esc(M.SEVERITIES[task.severity] || task.severity || "غير محددة")}</span>`;
  }

  function statusBadge(task) {
    const status = Object.hasOwn(M.STATUSES, task.status) ? task.status : "pending";
    return `<span class="status-badge status-${status}">${icon(statusIcons[status])}<span>${esc(M.STATUSES[status])}</span></span>`;
  }

  function platform(task) {
    const value = M.platforms(task);
    return value.mobile && value.backend
      ? "الموبايل والخادم"
      : value.backend
        ? "الخادم"
        : value.mobile
          ? "الموبايل"
          : "غير محددة";
  }

  function formatTitle(value) {
    return esc(value).replace(
      /\(([A-Za-z][A-Za-z0-9 _./-]*)\)/g,
      '<bdi class="bidi-term" dir="ltr">($1)</bdi>',
    );
  }

  function titleButton(task, context) {
    return `<button type="button" class="issue-title" data-open-task="${esc(task.id)}" data-focus-key="${esc(`${context}-title-${task.id}`)}">${formatTitle(task.title)}</button>`;
  }

  function listRow(task, index) {
    return `<tr class="issue-row" data-open-task="${esc(task.id)}"><td class="issue-index-cell"><span class="issue-index mono">${index}</span></td><td><div class="issue-identity"><bdi class="issue-id">${esc(task.id)}</bdi><span class="issue-types">${task.types.map((key) => esc(M.TYPES[key] || key)).join(" · ")}</span></div>${titleButton(task, "list")}</td><td>${severity(task)}</td><td><bdi class="module-name">${esc(task.moduleName)}</bdi></td><td>${statusBadge(task)}</td></tr>`;
  }

  function inlineText(value) {
    return esc(value).replace(/`([^`\n]+)`/g, '<bdi class="inline-label" dir="auto">$1</bdi>');
  }

  function scenario(value) {
    if (!value.trim()) return '<p class="muted">لم تُضف تفاصيل التجربة والأثر بعد.</p>';
    return value
      .trim()
      .split("\n")
      .map((line) => {
        if (!line.trim()) return '<span class="scenario-break" aria-hidden="true"></span>';
        const step = line.trim().match(/^(\d+)[.\-)]+\s+(.*)$/);
        return step
          ? `<p class="scenario-step"><span class="scenario-number" aria-hidden="true">${esc(step[1])}</span><span>${inlineText(step[2])}</span></p>`
          : `<p>${inlineText(line.trim())}</p>`;
      })
      .join("");
  }

  function detailSection(content) {
    return `<section class="detail-section"><h3><span class="section-index" aria-hidden="true">01</span>التجربة والأثر</h3><div class="rich-text">${scenario(content)}</div></section>`;
  }

  function reportCard(task) {
    const collapsed = collapsedReports.has(task.id);
    const toggle = `<button type="button" class="icon-button report-toggle" data-toggle-report="${esc(task.id)}" data-focus-key="report-toggle-${esc(task.id)}" aria-expanded="${!collapsed}" aria-label="${collapsed ? "توسيع" : "طي"} المشكلة ${esc(task.id)}" title="${collapsed ? "عرض التفاصيل" : "طي التفاصيل"}">${icon("chevron")}</button>`;
    if (collapsed) {
      return `<article class="report-card is-collapsed"><div class="report-compact-row">${toggle}<div class="report-compact-main"><div class="issue-identity"><bdi class="issue-id">${esc(task.id)}</bdi><span class="issue-types">${task.types.map((key) => esc(M.TYPES[key] || key)).join(" · ")}</span></div>${titleButton(task, "report")}</div><div class="report-compact-severity">${severity(task)}</div><div class="report-compact-module"><bdi class="module-name">${esc(task.moduleName)}</bdi><span class="platform-label">${platform(task)}</span></div><div class="report-compact-status">${statusBadge(task)}</div></div></article>`;
    }
    return `<article class="report-card"><header class="report-card-header"><div class="report-topline">${toggle}<bdi class="issue-id">${esc(task.id)}</bdi>${severity(task)}${statusBadge(task)}</div>${titleButton(task, "report")}<div class="platform-label">${esc(task.moduleName)} · ${platform(task)} · ${task.types.map((key) => esc(M.TYPES[key] || key)).join(" · ")}</div></header><div class="report-card-body">${detailSection(task.testScenario)}</div></article>`;
  }

  function pageTokens(current, pages) {
    if (pages <= 7) return Array.from({ length: pages }, (_, index) => index + 1);
    if (current <= 4) return [1, 2, 3, 4, 5, "end-gap", pages];
    if (current >= pages - 3) return [1, "start-gap", pages - 4, pages - 3, pages - 2, pages - 1, pages];
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
      $("results").innerHTML = `<div class="empty-state"><span class="empty-symbol">${icon(hasData ? "search" : "layers")}</span><h3>${hasData ? "لا توجد مشاكل تطابق اختياراتك" : "تقرير الجودة جاهز لأول فحص"}</h3><p>${hasData ? "جرّب كلمات بحث أقصر أو أزل بعض الفلاتر لعرض نتائج أكثر." : "ستظهر المشاكل هنا بعد إضافة نتائج تدقيق المشروع."}</p>${hasData ? '<button type="button" class="button primary" data-action="reset">مسح الفلاتر وعرض الكل</button>' : ""}</div>`;
    } else if (state.view === "report") {
      $("results").innerHTML = `<div class="report-list">${page.items.map(reportCard).join("")}</div>`;
    } else {
      const offset = (page.page - 1) * page.pageSize;
      $("results").innerHTML = `<table class="issue-table"><caption class="sr-only">مشاكل المشروع، مرتبة حسب الاختيار الحالي</caption><thead><tr><th class="issue-index-heading" scope="col">#</th><th scope="col">المشكلة</th><th scope="col">الأهمية</th><th scope="col">الوحدة</th><th scope="col">الحالة</th></tr></thead><tbody>${page.items.map((task, index) => listRow(task, offset + index + 1)).join("")}</tbody></table>`;
    }
    $("pagination").hidden = page.total <= M.PAGE_SIZE;
    $("pageInfo").textContent = `صفحة ${page.page} من ${page.pages}، ${page.pageSize} مشكلة في الصفحة`;
    renderPageNumbers(page);
    $("prevPageBtn").disabled = page.page <= 1;
    $("nextPageBtn").disabled = page.page >= page.pages;
  }

  function focusKey(key) {
    return [...document.querySelectorAll("[data-focus-key]")].find((element) => element.dataset.focusKey === key);
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
      else if (!$("taskDialog").open) $("resultsHeading").focus({ preventScroll: true });
    } else if (removedFilter && !focused.isConnected) {
      $("searchInput").focus({ preventScroll: true });
    }
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

  function moduleBadge(task) {
    return `<span class="module-badge"><span class="module-kicker">الوحدة</span><bdi>${esc(task.moduleName)}</bdi></span>`;
  }

  function renderDetail(resetScroll) {
    const task = tasks.find((item) => item.id === state.task);
    if (!task) return;
    const content = $("detailContent");
    const scroll = content.scrollTop;
    const index = filtered.findIndex((item) => item.id === task.id);
    $("detailHeaderMeta").innerHTML = `<div class="dialog-id"><bdi class="mono">${esc(task.id)}</bdi></div>${severity(task)}${statusBadge(task)}`;
    content.innerHTML = `${index < 0 ? '<p class="dialog-note">هذه المشكلة خارج التصفية الحالية. يمكنك متابعة عرضها هنا.</p>' : ""}<h2 class="detail-title" id="detailTitle">${formatTitle(task.title)}</h2><div class="detail-meta">${moduleBadge(task)}<span class="neutral-tag">${platform(task)}</span>${task.types.map((key) => `<span class="neutral-tag">${esc(M.TYPES[key] || key)}</span>`).join("")}</div>${detailSection(task.testScenario)}`;
    content.scrollTop = resetScroll ? 0 : scroll;
    $("detailPosition").textContent = index >= 0 ? `${index + 1} من ${filtered.length} في النتائج الحالية` : "خارج النتائج الحالية";
    $("prevTaskBtn").disabled = index <= 0;
    $("nextTaskBtn").disabled = index < 0 || index >= filtered.length - 1;
  }

  function openTask(id, trigger) {
    if (!tasks.some((task) => task.id === id)) return;
    state.task = id;
    if (trigger) returnFocusKey = trigger.dataset.focusKey || "";
    renderDetail(true);
    const dialog = $("taskDialog");
    if (!dialog.open) dialog.showModal();
    $("closeDetailBtn").focus({ preventScroll: true });
    syncUrl();
  }

  function closeTask() {
    if ($("taskDialog").open) $("taskDialog").close();
  }

  function moveTask(step) {
    const index = filtered.findIndex((task) => task.id === state.task);
    if (index >= 0 && filtered[index + step]) openTask(filtered[index + step].id);
  }

  function updateThemeButton() {
    const dark = document.documentElement.dataset.theme === "dark";
    const label = dark ? "تفعيل الوضع الفاتح" : "تفعيل الوضع الداكن";
    $("themeToggleBtn").setAttribute("aria-label", label);
    $("themeToggleBtn").setAttribute("title", label);
    $("themeToggleBtn").innerHTML = icon(dark ? "sun" : "moon");
  }

  function closeFilters(restoreFocus = true) {
    if (!$("filterPanel").open) return;
    $("filterPanel").open = false;
    if (restoreFocus) $("filterPanel").querySelector("summary").focus();
  }

  function drawerLimits() {
    const max = Math.max(MIN_DRAWER_WIDTH, Math.min(MAX_DRAWER_WIDTH, window.innerWidth - 24));
    return { min: Math.min(MIN_DRAWER_WIDTH, max), max };
  }

  function setDrawerWidth(width, persist = false) {
    const { min, max } = drawerLimits();
    preferredDrawerWidth = Math.min(max, Math.max(min, Number(width) || DEFAULT_DRAWER_WIDTH));
    $("taskDialog").style.setProperty("--drawer-width", `${preferredDrawerWidth}px`);
    $("drawerResizeHandle").setAttribute("aria-valuenow", Math.round(preferredDrawerWidth));
    if (persist) {
      try {
        localStorage.setItem(DRAWER_WIDTH_KEY, String(Math.round(preferredDrawerWidth)));
      } catch (_) {
        /* Resizing still works for this session. */
      }
    }
  }

  function initDrawerResize() {
    try {
      preferredDrawerWidth = Number(localStorage.getItem(DRAWER_WIDTH_KEY)) || DEFAULT_DRAWER_WIDTH;
    } catch (_) {
      preferredDrawerWidth = DEFAULT_DRAWER_WIDTH;
    }
    setDrawerWidth(preferredDrawerWidth);
    const handle = $("drawerResizeHandle");
    let dragging = false;
    handle.addEventListener("pointerdown", (event) => {
      dragging = true;
      handle.setPointerCapture?.(event.pointerId);
      document.body.classList.add("is-resizing-drawer");
    });
    handle.addEventListener("pointermove", (event) => {
      if (!dragging) return;
      setDrawerWidth(window.innerWidth - event.clientX);
    });
    const finish = () => {
      if (!dragging) return;
      dragging = false;
      document.body.classList.remove("is-resizing-drawer");
      setDrawerWidth(preferredDrawerWidth, true);
    };
    handle.addEventListener("pointerup", finish);
    handle.addEventListener("pointercancel", finish);
    handle.addEventListener("dblclick", () => setDrawerWidth(DEFAULT_DRAWER_WIDTH, true));
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
    window.addEventListener("resize", () => setDrawerWidth(preferredDrawerWidth));
  }

  $("typeOptions").innerHTML = types
    .map((key) => `<label class="type-option"><input type="checkbox" data-type="${esc(key)}" checked><span>${esc(M.TYPES[key] || key)}</span></label>`)
    .join("");

  const projectName = $("projectName").textContent.trim();
  if (!projectName || projectName.includes("{{PROJECT_NAME}}")) {
    $("projectName").textContent = "قالب تجريبي";
    document.title = "مِعيار — قالب تقرير الجودة";
    $("dataNote").textContent = "بيانات توضيحية · تقرير للعرض فقط";
  }

  fillIcons();
  updateThemeButton();
  initDrawerResize();
  render();
  if (state.task) openTask(state.task);

  $("searchInput").addEventListener("input", (event) => changeFilters({ search: event.target.value }));
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
    $(id).addEventListener("change", (event) => changeFilters({ [key]: event.target.value }));
  }
  $("pageSizeSelect").addEventListener("change", (event) => changeFilters({ pageSize: Number(event.target.value) }));
  $("typeOptions").addEventListener("change", () => {
    const selected = [...$("typeOptions").querySelectorAll("input:checked")].map((input) => input.dataset.type);
    changeFilters({ types: selected.length === types.length ? null : selected });
  });
  $("allTypesBtn").addEventListener("click", () => changeFilters({ types: null }));
  $("noTypesBtn").addEventListener("click", () => changeFilters({ types: [] }));
  $("closeFiltersBtn").addEventListener("click", () => closeFilters());
  $("themeToggleBtn").addEventListener("click", () => {
    const theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("qa_theme", theme);
    } catch (_) {
      /* Theme still applies for this session. */
    }
    updateThemeButton();
  });
  for (const [id, step] of [["prevPageBtn", -1], ["nextPageBtn", 1]]) {
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
    syncUrl();
    (focusKey(returnFocusKey) || $("resultsHeading")).focus({ preventScroll: true });
  });
  $("taskDialog").addEventListener("click", (event) => {
    if (event.target !== $("taskDialog")) return;
    const rect = $("taskDialog").getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeTask();
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
      } else if (button.dataset.openTask !== undefined) {
        openTask(button.dataset.openTask, button);
      } else if (button.dataset.action === "reset") {
        resetFilters();
      } else if (button.dataset.removeFilter) {
        changeFilters({ [button.dataset.removeFilter]: M.defaults()[button.dataset.removeFilter] });
      } else if (button.dataset.view) {
        state.view = button.dataset.view;
        render();
      } else if (button.dataset.preset) {
        const preset = button.dataset.preset;
        const active = button.getAttribute("aria-pressed") === "true";
        changeFilters({
          statuses: active
            ? []
            : preset === "priority" || preset === "open"
              ? ["pending", "in_progress"]
              : preset === "all"
                ? []
                : [preset],
          severity: !active && preset === "priority" ? "Priority" : "all",
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
    if (event.key === "Escape" && $("filterPanel").open && !$("taskDialog").open) {
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
