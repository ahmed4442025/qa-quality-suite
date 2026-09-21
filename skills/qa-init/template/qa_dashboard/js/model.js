/* Shared, DOM-independent data rules. Existing MODULE_* files remain unchanged. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.QAModel = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const TYPES = {
    bug: "خطأ برمجي",
    ui: "واجهة المستخدم",
    ux: "تجربة المستخدم",
    suggest: "اقتراح تحسين",
    perf: "الأداء والذاكرة",
    security: "الأمان والجلسات",
    refactor: "الهيكلة والمعايير",
    archive: "مؤجل — تصنيف سابق",
  };
  const STATUSES = {
    pending: "قيد الانتظار",
    in_progress: "جاري العمل",
    done: "تم الحل",
    archived: "مؤرشف",
    cancelled: "ملغي",
  };
  const SEVERITIES = {
    Critical: "حرجة",
    High: "عالية",
    Medium: "متوسطة",
    Low: "منخفضة",
  };
  const PAGE_SIZES = [25, 50, 100, 200];
  const PAGE_SIZE = PAGE_SIZES[0];
  const cleanName = (value) =>
    String(value || "")
      .replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, "")
      .trim();
  const text = (value) => String(value ?? "");
  const escape = (value) =>
    text(value).replace(
      /[&<>"']/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[char],
    );
  function normalize(modules) {
    return modules.flatMap((mod, moduleIndex) => {
      if (!mod || !Array.isArray(mod.tasks)) return [];
      return mod.tasks
        .filter((t) => t && typeof t === "object")
        .map((t) => ({
          ...t,
          id: text(t.id),
          title: text(t.title) || "مشكلة بدون عنوان",
          file: text(t.file),
          testScenario: text(t.testScenario),
          technicalAnalysis: text(t.technicalAnalysis),
          solution: text(t.solution),
          moduleId: text(mod.moduleId || `module_${moduleIndex}`),
          moduleName:
            cleanName(mod.moduleName || mod.moduleId) || "وحدة بدون اسم",
          types: [
            ...new Set(
              (Array.isArray(t.types) && t.types.length
                ? t.types
                : [t.type || "bug"]
              ).map(text),
            ),
          ],
          status: Object.hasOwn(STATUSES, t.status) ? t.status : "pending",
          severity: text(t.severity),
          requiresBackend: Boolean(t.requiresBackend),
        }));
    });
  }
  const typeKeys = (tasks) => [
    ...new Set([...Object.keys(TYPES), ...tasks.flatMap((t) => t.types)]),
  ];
  const defaults = () => ({
    module: "all",
    statuses: [],
    severity: "all",
    culprit: "all",
    search: "",
    types: null,
    sort: "priority",
    view: "list",
    page: 1,
    pageSize: PAGE_SIZE,
    task: "",
  });
  function fromUrl(search, tasks) {
    const p = new URLSearchParams(search),
      state = defaults(),
      keys = typeKeys(tasks);
    if (tasks.some((t) => t.moduleId === p.get("module")))
      state.module = p.get("module");
    const requestedStatuses = p.has("statuses")
      ? p.get("statuses").split(",")
      : p.get("status") === "open"
        ? ["pending", "in_progress"]
        : [p.get("status")];
    state.statuses = [
      ...new Set(requestedStatuses.filter((key) => Object.hasOwn(STATUSES, key))),
    ];
    if (["all", ...Object.keys(SEVERITIES)].includes(p.get("severity")))
      state.severity = p.get("severity");
    if (["all", "Mobile", "Backend", "Both"].includes(p.get("culprit")))
      state.culprit = p.get("culprit");
    state.search = p.get("search") || "";
    if (p.has("types"))
      state.types = [
        ...new Set(
          p
            .get("types")
            .split(",")
            .filter((k) => keys.includes(k)),
        ),
      ];
    if (["priority", "status", "id"].includes(p.get("sort")))
      state.sort = p.get("sort");
    if (["report", "board"].includes(p.get("view"))) state.view = p.get("view");
    state.page = Math.min(
      100000,
      Math.max(1, Math.floor(Number(p.get("page")) || 1)),
    );
    if (PAGE_SIZES.includes(Number(p.get("pageSize"))))
      state.pageSize = Number(p.get("pageSize"));
    state.task = tasks.some((t) => t.id === p.get("task")) ? p.get("task") : "";
    return state;
  }
  function toUrl(state) {
    const p = new URLSearchParams(),
      initial = defaults();
    for (const key of [
      "module",
      "severity",
      "culprit",
      "search",
      "sort",
      "view",
      "page",
      "pageSize",
      "task",
    ]) {
      if (state[key] !== initial[key] && state[key] !== "")
        p.set(key, state[key]);
    }
    if (state.statuses.length) p.set("statuses", state.statuses.join(","));
    if (state.types !== null) p.set("types", state.types.join(","));
    return p.toString();
  }
  const isOpen = (t) => t.status === "pending" || t.status === "in_progress";
  function platforms(task) {
    return {
      mobile:
        task.culprit === "Mobile" || task.culprit === "Both" || !task.culprit,
      backend:
        task.requiresBackend ||
        task.culprit === "Backend" ||
        task.culprit === "Both",
    };
  }
  function scope(tasks, state) {
    return tasks.filter((t) => {
      if (state.module !== "all" && t.moduleId !== state.module) return false;
      const { mobile, backend } = platforms(t);
      return (
        state.culprit === "all" ||
        (state.culprit === "Mobile" && mobile) ||
        (state.culprit === "Backend" && backend) ||
        (state.culprit === "Both" && mobile && backend)
      );
    });
  }
  function filter(tasks, state) {
    const q = state.search.trim().toLocaleLowerCase();
    return scope(tasks, state).filter((t) => {
      if (state.statuses.length && !state.statuses.includes(t.status))
        return false;
      if (state.severity !== "all" && t.severity !== state.severity)
        return false;
      if (
        state.types !== null &&
        !t.types.some((type) => state.types.includes(type))
      )
        return false;
      if (!q) return true;
      return [
        t.id,
        t.title,
        t.file,
        t.moduleName,
        t.solution,
        t.testScenario,
        t.technicalAnalysis,
        ...t.types.flatMap((k) => [k, TYPES[k] || k]),
      ]
        .join(" ")
        .toLocaleLowerCase()
        .includes(q);
    });
  }
  function sort(tasks, by) {
    const severities = Object.keys(SEVERITIES),
      statuses = Object.keys(STATUSES);
    const rank = (list, value) =>
      list.includes(value) ? list.indexOf(value) : list.length;
    return [...tasks].sort((a, b) => {
      const priority =
        rank(severities, a.severity) - rank(severities, b.severity);
      const status = rank(statuses, a.status) - rank(statuses, b.status);
      const id = a.id.localeCompare(b.id, "en", { numeric: true });
      return by === "id"
        ? id
        : by === "status"
          ? status || priority || id
          : priority || status || id;
    });
  }
  function stats(tasks) {
    const open = tasks.filter(isOpen);
    return {
      total: tasks.length,
      open: open.length,
      critical: open.filter((t) => t.severity === "Critical").length,
      high: open.filter((t) => t.severity === "High").length,
      in_progress: tasks.filter((t) => t.status === "in_progress").length,
      done: tasks.filter((t) => t.status === "done").length,
      completionTotal: tasks.filter((t) =>
        ["pending", "in_progress", "done"].includes(t.status),
      ).length,
    };
  }
  function paginate(tasks, page, requestedSize = PAGE_SIZE) {
    const pageSize = PAGE_SIZES.includes(Number(requestedSize))
      ? Number(requestedSize)
      : PAGE_SIZE;
    const pages = Math.max(1, Math.ceil(tasks.length / pageSize));
    const current = Math.min(pages, Math.max(1, Math.floor(page) || 1));
    return {
      items: tasks.slice((current - 1) * pageSize, current * pageSize),
      page: current,
      pages,
      pageSize,
      total: tasks.length,
    };
  }
  async function persistStatus(task, status, fetcher) {
    if (!Object.hasOwn(STATUSES, status)) throw new Error("Invalid status");
    const response = await fetcher("/api/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: task.id, status }),
    });
    const body = await response.json();
    if (!response.ok || body.ok !== true)
      throw new Error("Status could not be saved");
    task.status = status;
  }
  return {
    TYPES,
    STATUSES,
    SEVERITIES,
    PAGE_SIZE,
    PAGE_SIZES,
    normalize,
    typeKeys,
    defaults,
    fromUrl,
    toUrl,
    platforms,
    scope,
    filter,
    sort,
    stats,
    paginate,
    persistStatus,
    escape,
  };
});
