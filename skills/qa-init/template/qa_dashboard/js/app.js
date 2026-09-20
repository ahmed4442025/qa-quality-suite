/**
 * QA Bug Tracker Core App - Jira / Excel Style Table View
 * Handles dynamic module loading, multi-select type filtering, dual platform indicators (Mobile/Backend), localStorage persistence, copy-to-clipboard, markdown/code block rendering.
 */

// 0. Dark Mode Management
function initTheme() {
  const savedTheme = localStorage.getItem("qa_theme");
  const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark = savedTheme === "dark" || (!savedTheme && systemPrefersDark);
  applyTheme(isDark);
}

function toggleDarkMode() {
  const isCurrentlyDark = document.documentElement.classList.contains("dark");
  applyTheme(!isCurrentlyDark);
}

function applyTheme(isDark) {
  if (isDark) {
    document.documentElement.classList.add("dark");
    localStorage.setItem("qa_theme", "dark");
  } else {
    document.documentElement.classList.remove("dark");
    localStorage.setItem("qa_theme", "light");
  }
  updateThemeButtonUI(isDark);
  if (typeof syncControlsFromState === "function") {
    syncControlsFromState();
  }
}

function updateThemeButtonUI(isDark) {
  const icon = document.getElementById("themeToggleIcon");
  const text = document.getElementById("themeToggleText");
  const btn = document.getElementById("themeToggleBtn");
  if (icon) icon.textContent = isDark ? "☀️" : "🌙";
  if (text) text.textContent = isDark ? "الوضع الفاتح" : "الوضع الداكن";
  if (btn) btn.setAttribute("title", isDark ? "تفعيل الوضع الفاتح" : "تفعيل الوضع الداكن");
}

// 1. Issue Types Registry
const ISSUE_TYPES = {
  bug: {
    id: "bug",
    label: "خطأ برمجي",
    enLabel: "Bug",
    icon: "🐛",
    badgeClass: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800",
    pillActiveClass: "bg-rose-600 text-white border-rose-600 shadow-sm",
    pillInactiveClass: "bg-white text-rose-700 border-rose-200 hover:bg-rose-50 dark:bg-slate-800 dark:text-rose-400 dark:border-rose-900/60 dark:hover:bg-rose-950/40"
  },
  ui: {
    id: "ui",
    label: "واجهة مستخدم",
    enLabel: "UI",
    icon: "🎨",
    badgeClass: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800",
    pillActiveClass: "bg-sky-600 text-white border-sky-600 shadow-sm",
    pillInactiveClass: "bg-white text-sky-700 border-sky-200 hover:bg-sky-50 dark:bg-slate-800 dark:text-sky-400 dark:border-sky-900/60 dark:hover:bg-sky-950/40"
  },
  ux: {
    id: "ux",
    label: "تجربة مستخدم",
    enLabel: "UX",
    icon: "💡",
    badgeClass: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800",
    pillActiveClass: "bg-purple-600 text-white border-purple-600 shadow-sm",
    pillInactiveClass: "bg-white text-purple-700 border-purple-200 hover:bg-purple-50 dark:bg-slate-800 dark:text-purple-400 dark:border-purple-900/60 dark:hover:bg-purple-950/40"
  },
  suggest: {
    id: "suggest",
    label: "اقتراح تحسين",
    enLabel: "Suggest",
    icon: "✨",
    badgeClass: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
    pillActiveClass: "bg-amber-500 text-white border-amber-500 shadow-sm",
    pillInactiveClass: "bg-white text-amber-800 border-amber-200 hover:bg-amber-50 dark:bg-slate-800 dark:text-amber-400 dark:border-amber-900/60 dark:hover:bg-amber-950/40"
  },
  perf: {
    id: "perf",
    label: "أداء وذاكرة",
    enLabel: "Perf",
    icon: "⚡",
    badgeClass: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800",
    pillActiveClass: "bg-teal-600 text-white border-teal-600 shadow-sm",
    pillInactiveClass: "bg-white text-teal-700 border-teal-200 hover:bg-teal-50 dark:bg-slate-800 dark:text-teal-400 dark:border-teal-900/60 dark:hover:bg-teal-950/40"
  },
  security: {
    id: "security",
    label: "أمان وجلسات",
    enLabel: "Security",
    icon: "🔒",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
    pillActiveClass: "bg-emerald-600 text-white border-emerald-600 shadow-sm",
    pillInactiveClass: "bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50 dark:bg-slate-800 dark:text-emerald-400 dark:border-emerald-900/60 dark:hover:bg-emerald-950/40"
  },
  refactor: {
    id: "refactor",
    label: "معايير وهيكلة",
    enLabel: "Refactor",
    icon: "⚙️",
    badgeClass: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
    pillActiveClass: "bg-slate-700 text-white border-slate-700 shadow-sm dark:bg-slate-600 dark:border-slate-600",
    pillInactiveClass: "bg-white text-slate-700 border-slate-300 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700"
  },
  archive: {
    id: "archive",
    label: "مؤرشف / مؤجل",
    enLabel: "Archive",
    icon: "📦",
    badgeClass: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/60 dark:text-violet-300 dark:border-violet-800",
    pillActiveClass: "bg-violet-600 text-white border-violet-600 shadow-sm",
    pillInactiveClass: "bg-white text-violet-700 border-violet-200 hover:bg-violet-50 dark:bg-slate-800 dark:text-violet-400 dark:border-violet-900/60 dark:hover:bg-violet-950/40"
  }
};

const ALL_TYPE_KEYS = Object.keys(ISSUE_TYPES);

let allTasks = [];
let activeStatusFilter = "all";
let activeSeverityFilter = "all";
let activeCulpritFilter = "all";
let activeModuleFilter = "all";
let searchQuery = "";
let activeTypeFilters = new Set(ALL_TYPE_KEYS); // Default: all types selected

// Double-click handler state for quick filter chips
let chipClickTimer = null;
let lastClickedChip = null;

// 2. URL Query State Synchronization (Preserves filters on refresh without localStorage coupling)
function loadFiltersFromUrl() {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.has("module")) activeModuleFilter = params.get("module");
    if (params.has("status")) activeStatusFilter = params.get("status");
    if (params.has("severity")) activeSeverityFilter = params.get("severity");
    if (params.has("culprit")) activeCulpritFilter = params.get("culprit");
    if (params.has("search")) searchQuery = params.get("search");
    if (params.has("types")) {
      const parsedTypes = params.get("types").split(",").filter(t => ALL_TYPE_KEYS.includes(t));
      if (parsedTypes.length > 0) activeTypeFilters = new Set(parsedTypes);
    }
  } catch (e) {
    console.error("فشل قراءة الفلاتر من الـ URL:", e);
  }
}

function syncUrlFromFilters() {
  try {
    const params = new URLSearchParams();
    if (activeModuleFilter && activeModuleFilter !== "all") params.set("module", activeModuleFilter);
    if (activeStatusFilter && activeStatusFilter !== "all") params.set("status", activeStatusFilter);
    if (activeSeverityFilter && activeSeverityFilter !== "all") params.set("severity", activeSeverityFilter);
    if (activeCulpritFilter && activeCulpritFilter !== "all") params.set("culprit", activeCulpritFilter);
    if (searchQuery && searchQuery.trim()) params.set("search", searchQuery.trim());
    if (activeTypeFilters.size > 0 && activeTypeFilters.size < ALL_TYPE_KEYS.length) {
      params.set("types", Array.from(activeTypeFilters).join(","));
    }

    const qs = params.toString();
    const newUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    window.history.replaceState(null, "", newUrl);
  } catch (e) {
    // Fallback for isolated contexts
  }
}

function syncControlsFromState() {
  // 1. Search input
  const searchInput = document.getElementById("searchInput");
  if (searchInput) searchInput.value = searchQuery;

  // 2. Module Dropdown
  renderModuleOptions();

  // 3. Culprit select
  const culpritSelect = document.getElementById("culpritFilter");
  if (culpritSelect) culpritSelect.value = activeCulpritFilter;

  // 4. Status buttons
  document.querySelectorAll("[data-status-filter]").forEach(b => {
    const st = b.getAttribute("data-status-filter");
    if (st === activeStatusFilter) {
      b.className = "px-2.5 py-1.5 rounded-md bg-slate-900 text-white font-bold shadow-sm border border-slate-900 ring-2 ring-slate-300/60 dark:bg-indigo-600 dark:border-indigo-600 dark:ring-indigo-400/40 transition";
    } else {
      b.className = "px-2.5 py-1.5 rounded-md bg-white text-slate-700 font-bold border border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700 transition";
    }
  });

  // 5. Severity buttons
  document.querySelectorAll("[data-severity-filter]").forEach(b => {
    const sev = b.getAttribute("data-severity-filter");
    if (sev === activeSeverityFilter) {
      if (sev === "Critical") b.className = "px-2.5 py-1.5 rounded-md bg-rose-600 text-white font-bold shadow-sm border border-rose-600 ring-2 ring-rose-300 dark:ring-rose-800 transition";
      else if (sev === "High") b.className = "px-2.5 py-1.5 rounded-md bg-orange-600 text-white font-bold shadow-sm border border-orange-600 ring-2 ring-orange-300 dark:ring-orange-800 transition";
      else if (sev === "Medium") b.className = "px-2.5 py-1.5 rounded-md bg-amber-500 text-white font-bold shadow-sm border border-amber-500 ring-2 ring-amber-300 dark:ring-amber-800 transition";
      else if (sev === "Low") b.className = "px-2.5 py-1.5 rounded-md bg-sky-600 text-white font-bold shadow-sm border border-sky-600 ring-2 ring-sky-300 dark:ring-sky-800 transition";
      else b.className = "px-2.5 py-1.5 rounded-md bg-slate-900 text-white font-bold shadow-sm border border-slate-900 ring-2 ring-slate-300/60 dark:bg-indigo-600 dark:border-indigo-600 dark:ring-indigo-400/40 transition";
    } else {
      if (sev === "Critical") b.className = "px-2.5 py-1.5 rounded-md bg-white text-rose-700 font-bold border border-rose-200 hover:bg-rose-50 dark:bg-slate-800 dark:text-rose-400 dark:border-rose-900/60 dark:hover:bg-rose-950/40 transition";
      else if (sev === "High") b.className = "px-2.5 py-1.5 rounded-md bg-white text-orange-700 font-bold border border-orange-200 hover:bg-orange-50 dark:bg-slate-800 dark:text-orange-400 dark:border-orange-900/60 dark:hover:bg-orange-950/40 transition";
      else if (sev === "Medium") b.className = "px-2.5 py-1.5 rounded-md bg-white text-amber-800 font-bold border border-amber-300 hover:bg-amber-50 dark:bg-slate-800 dark:text-amber-400 dark:border-amber-900/60 dark:hover:bg-amber-950/40 transition";
      else if (sev === "Low") b.className = "px-2.5 py-1.5 rounded-md bg-white text-sky-700 font-bold border border-sky-200 hover:bg-sky-50 dark:bg-slate-800 dark:text-sky-400 dark:border-sky-900/60 dark:hover:bg-sky-950/40 transition";
      else b.className = "px-2.5 py-1.5 rounded-md bg-white text-slate-700 font-bold border border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700 transition";
    }
  });
}

// 3. Initialize
function initApp() {
  initTheme();
  loadFiltersFromUrl();
  loadTasksFromModules();
  renderModuleOptions();
  syncControlsFromState();
  renderTypeMultiSelectControls();
  updateDashboard();
}

// 4. Load & merge tasks
function loadTasksFromModules() {
  allTasks = [];

  const moduleKeys = Object.keys(window).filter(k => k.startsWith("MODULE_"));
  moduleKeys.forEach(k => {
    const mod = window[k];
    if (mod && Array.isArray(mod.tasks)) {
      mod.tasks.forEach(t => {
        // Normalize types
        let taskTypes = [];
        if (Array.isArray(t.types) && t.types.length > 0) {
          taskTypes = t.types;
        } else if (typeof t.type === "string" && t.type.trim()) {
          taskTypes = [t.type.trim()];
        } else {
          taskTypes = ["bug"];
        }

        allTasks.push({
          ...t,
          types: taskTypes,
          moduleId: mod.moduleId,
          moduleName: mod.moduleName,
          status: t.status || "pending"
        });
      });
    }
  });
}

// 5. Populate & Render Module Options (LTR English Dropdown)
function renderModuleOptions() {
  const container = document.getElementById("moduleOptionsContainer");
  const summaryText = document.getElementById("moduleFilterSummaryText");
  const badge = document.getElementById("moduleFilterBadge");
  
  const modulesMap = new Map();
  allTasks.forEach(t => {
    if (!modulesMap.has(t.moduleId)) {
      modulesMap.set(t.moduleId, { id: t.moduleId, name: t.moduleName, count: 0 });
    }
    modulesMap.get(t.moduleId).count++;
  });

  const modules = Array.from(modulesMap.values());
  
  // Validate activeModuleFilter
  if (!modulesMap.has(activeModuleFilter) && activeModuleFilter !== "all") {
    activeModuleFilter = "all";
  }

  // Update Trigger Button Display
  if (summaryText && badge) {
    if (activeModuleFilter === "all") {
      summaryText.textContent = "📦 All Modules";
      badge.textContent = `${allTasks.length}`;
      badge.className = "text-[11px] px-2 py-0.5 rounded-full font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800";
    } else {
      const activeMod = modulesMap.get(activeModuleFilter);
      summaryText.textContent = activeMod ? activeMod.name : activeModuleFilter;
      badge.textContent = activeMod ? `${activeMod.count}` : "0";
      badge.className = "text-[11px] px-2 py-0.5 rounded-full font-bold bg-indigo-600 text-white shadow-xs border border-indigo-600";
    }
  }

  if (!container) return;

  const allOptionHtml = `
    <button type="button" onclick="selectModule('all')"
            class="w-full flex items-center justify-between p-2 rounded-lg text-xs font-bold text-left transition select-none cursor-pointer ${
              activeModuleFilter === "all"
                ? "bg-slate-900 text-white shadow-sm dark:bg-indigo-600"
                : "hover:bg-slate-50 text-slate-800 dark:text-slate-200 dark:hover:bg-slate-800/60"
            }">
      <div class="flex items-center gap-2 truncate">
        <span class="truncate">📦 All Modules</span>
      </div>
      <span class="text-[11px] px-2 py-0.5 rounded-full font-bold shrink-0 transition ${
        activeModuleFilter === "all"
          ? "bg-slate-800 text-white border border-slate-700 dark:bg-indigo-700"
          : "bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/70 dark:text-indigo-300 dark:border-indigo-800"
      }">
        ${allTasks.length}
      </span>
    </button>
  `;

  const moduleOptionsHtml = modules.map(m => {
    const isSelected = activeModuleFilter === m.id;
    return `
      <button type="button" onclick="selectModule('${m.id}')"
              class="w-full flex items-center justify-between p-2 rounded-lg text-xs font-bold text-left transition select-none cursor-pointer ${
                isSelected
                  ? "bg-slate-900 text-white shadow-sm dark:bg-indigo-600"
                  : "hover:bg-slate-50 text-slate-800 dark:text-slate-200 dark:hover:bg-slate-800/60"
              }">
        <div class="flex items-center gap-2 truncate">
          <span class="truncate">${m.name}</span>
        </div>
        <span class="text-[11px] px-2 py-0.5 rounded-full font-bold shrink-0 transition ${
          isSelected
            ? "bg-slate-800 text-white border border-slate-700 dark:bg-indigo-700"
            : "bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/70 dark:text-indigo-300 dark:border-indigo-800"
        }">
          ${m.count}
        </span>
      </button>
    `;
  }).join("");

  container.innerHTML = allOptionHtml + moduleOptionsHtml;
}

function selectModule(moduleId) {
  activeModuleFilter = moduleId;
  const menu = document.getElementById("moduleDropdownMenu");
  const chevron = document.getElementById("moduleDropdownChevron");
  menu?.classList.add("hidden");
  chevron?.classList.remove("rotate-180");

  renderModuleOptions();
  updateDashboard();
}

// 5. Render Multi-Select Controls (Dropdown & Quick Filter Chips)
function renderTypeMultiSelectControls() {
  renderTypeCheckboxes();
  renderTypeChips();
  updateTypeSummaryText();
}

function renderTypeCheckboxes() {
  const container = document.getElementById("typeCheckboxesContainer");
  if (!container) return;

  const counts = getTypeCounts();

  container.innerHTML = ALL_TYPE_KEYS.map(key => {
    const info = ISSUE_TYPES[key];
    const isChecked = activeTypeFilters.has(key);
    const count = counts[key] || 0;

    return `
      <label class="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer text-xs font-bold transition">
        <div class="flex items-center gap-2">
          <input type="checkbox" value="${key}" ${isChecked ? "checked" : ""}
                 class="type-checkbox rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600">
          <span class="flex items-center gap-1">
            <span>${info.icon}</span>
            <span class="text-slate-800 dark:text-slate-200">${info.enLabel}</span>
            <span class="text-slate-400 dark:text-slate-500 font-normal text-[11px]">(${info.label})</span>
          </span>
        </div>
        <span class="text-[11px] px-1.5 py-0.5 rounded-full font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">${count}</span>
      </label>
    `;
  }).join("");

  // Attach event listener to checkboxes
  container.querySelectorAll(".type-checkbox").forEach(cb => {
    cb.addEventListener("change", (e) => {
      const typeKey = e.target.value;
      if (e.target.checked) {
        activeTypeFilters.add(typeKey);
      } else {
        activeTypeFilters.delete(typeKey);
      }
      onTypeFilterChange();
    });
  });
}

function renderTypeChips() {
  const container = document.getElementById("typeChipsContainer");
  if (!container) return;

  const counts = getTypeCounts();
  const scoped = getScopedTasks();
  const isAllSelected = activeTypeFilters.size === ALL_TYPE_KEYS.length;

  const allChipHtml = `
    <button type="button" onclick="toggleAllTypes(true)"
            title="إظهار كافة الأنواع"
            class="px-2.5 py-1 rounded-md text-[11px] font-bold border transition select-none cursor-pointer ${
              isAllSelected
                ? "bg-slate-900 text-white border-slate-900 shadow-sm dark:bg-indigo-600 dark:border-indigo-600"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700"
            }">
      🌟 الكل (${scoped.length})
    </button>
  `;

  const typeChipsHtml = ALL_TYPE_KEYS.map(key => {
    const info = ISSUE_TYPES[key];
    const isSelected = activeTypeFilters.has(key);
    const count = counts[key] || 0;
    const styleClass = isSelected ? info.pillActiveClass : info.pillInactiveClass;

    return `
      <button type="button" 
              onclick="handleTypeChipClick('${key}', event)"
              ondblclick="selectOnlyThisType('${key}', event)"
              title="نقرة: تبديل التحديد | نقرتان: اختيار هذا النوع فقط"
              class="px-2.5 py-1 rounded-md text-[11px] font-bold border flex items-center gap-1 transition select-none cursor-pointer ${styleClass}">
        <span>${info.icon}</span>
        <span>${info.enLabel}</span>
        <span>(${count})</span>
      </button>
    `;
  }).join("");

  container.innerHTML = allChipHtml + typeChipsHtml;
}

function updateTypeSummaryText() {
  const summaryEl = document.getElementById("typeFilterSummaryText");
  if (!summaryEl) return;

  if (activeTypeFilters.size === ALL_TYPE_KEYS.length) {
    summaryEl.textContent = `كل أنواع المشاكل (${ALL_TYPE_KEYS.length})`;
  } else if (activeTypeFilters.size === 0) {
    summaryEl.textContent = "لا توجد أنواع محددة (0)";
  } else if (activeTypeFilters.size === 1) {
    const singleKey = Array.from(activeTypeFilters)[0];
    const info = ISSUE_TYPES[singleKey];
    summaryEl.textContent = `${info.icon} ${info.enLabel} (${info.label})`;
  } else {
    summaryEl.textContent = `محدد (${activeTypeFilters.size} أنواع)`;
  }
}

function getScopedTasks() {
  return allTasks.filter(t => {
    // 1. Module filter
    if (activeModuleFilter !== "all" && t.moduleId !== activeModuleFilter) return false;

    // 2. Culprit / Platform filter
    const isMobile = t.culprit === "Mobile" || t.culprit === "Both" || !t.culprit;
    const isBackend = Boolean(t.requiresBackend || t.culprit === "Backend" || t.culprit === "Both");

    if (activeCulpritFilter === "Mobile" && !isMobile) return false;
    if (activeCulpritFilter === "Backend" && !isBackend) return false;
    if (activeCulpritFilter === "Both" && !(isMobile && isBackend)) return false;

    return true;
  });
}

function getTypeCounts() {
  const counts = {};
  ALL_TYPE_KEYS.forEach(k => counts[k] = 0);
  const scoped = getScopedTasks();
  scoped.forEach(t => {
    if (Array.isArray(t.types)) {
      t.types.forEach(typeKey => {
        if (counts[typeKey] !== undefined) {
          counts[typeKey]++;
        }
      });
    }
  });
  return counts;
}

function handleTypeChipClick(typeKey, event) {
  if (event) event.preventDefault();

  if (chipClickTimer && lastClickedChip === typeKey) {
    // Double click detected -> Isolate / select only this type!
    clearTimeout(chipClickTimer);
    chipClickTimer = null;
    lastClickedChip = null;
    selectOnlyThisType(typeKey);
  } else {
    // Wait small threshold to see if second click comes
    if (chipClickTimer) clearTimeout(chipClickTimer);
    lastClickedChip = typeKey;
    chipClickTimer = setTimeout(() => {
      toggleSingleTypeFilter(typeKey);
      chipClickTimer = null;
      lastClickedChip = null;
    }, 230);
  }
}

function selectOnlyThisType(typeKey, event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  if (chipClickTimer) {
    clearTimeout(chipClickTimer);
    chipClickTimer = null;
    lastClickedChip = null;
  }
  activeTypeFilters = new Set([typeKey]);
  onTypeFilterChange();
}

function toggleSingleTypeFilter(typeKey) {
  if (activeTypeFilters.has(typeKey)) {
    activeTypeFilters.delete(typeKey);
  } else {
    activeTypeFilters.add(typeKey);
  }
  onTypeFilterChange();
}

function toggleAllTypes(selectAll) {
  if (selectAll) {
    activeTypeFilters = new Set(ALL_TYPE_KEYS);
  } else {
    activeTypeFilters.clear();
  }
  onTypeFilterChange();
}

function onTypeFilterChange() {
  renderTypeCheckboxes();
  renderTypeChips();
  updateTypeSummaryText();
  updateDashboard();
}

// 6. Update task status directly in file via server API
async function setTaskStatus(taskId, newStatus) {
  const task = allTasks.find(t => t.id === taskId);
  const oldStatus = task ? task.status : null;
  if (task) task.status = newStatus;
  updateDashboard();

  try {
    const res = await fetch("/api/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: taskId, status: newStatus })
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.error || ("HTTP " + res.status));
    }
  } catch (err) {
    console.error("فشل تحديث الحالة في الملف على الهارد:", err);
    alert("تعذر حفظ الحالة في الملف على الهارد!\nتأكد أن السيرفر يعمل عبر تشغيل run.bat أولاً.");
    if (task && oldStatus) {
      task.status = oldStatus;
      updateDashboard();
    }
  }
}

// 7. Refresh data from files
function refreshDashboard() {
  window.location.reload();
}

// 8. Copy to Clipboard
function copyText(text, btnElement) {
  navigator.clipboard.writeText(text).then(() => {
    const originalHTML = btnElement.innerHTML;
    btnElement.innerHTML = `
      <span class="inline-flex items-center gap-1 text-emerald-600 font-sans font-bold text-[11px]">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path></svg>
        تم النسخ
      </span>`;
    setTimeout(() => {
      btnElement.innerHTML = originalHTML;
    }, 1500);
  }).catch(err => {
    console.error("فشل النسخ:", err);
  });
}

// 9. Update View
function updateDashboard() {
  syncUrlFromFilters();
  renderTypeCheckboxes();
  renderTypeChips();
  updateTypeSummaryText();
  renderStats();
  renderTableRows();
}

function renderStats() {
  const scoped = getScopedTasks();

  document.getElementById("statTotal").textContent = scoped.length;
  document.getElementById("statPending").textContent = scoped.filter(t => t.status === "pending").length;
  document.getElementById("statInProgress").textContent = scoped.filter(t => t.status === "in_progress").length;
  document.getElementById("statDone").textContent = scoped.filter(t => t.status === "done").length;
  const statArchived = document.getElementById("statArchived");
  if (statArchived) statArchived.textContent = scoped.filter(t => t.status === "archived").length;
  document.getElementById("statCancelled").textContent = scoped.filter(t => t.status === "cancelled").length;
  document.getElementById("statBackend").textContent = scoped.filter(t => t.requiresBackend || t.culprit === "Backend" || t.culprit === "Both").length;

  // Status Tab Dynamic Counts
  const setElText = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  setElText("statusCount-all", `(${scoped.length})`);
  setElText("statusCount-pending", `(${scoped.filter(t => t.status === "pending").length})`);
  setElText("statusCount-in_progress", `(${scoped.filter(t => t.status === "in_progress").length})`);
  setElText("statusCount-done", `(${scoped.filter(t => t.status === "done").length})`);
  setElText("statusCount-archived", `(${scoped.filter(t => t.status === "archived").length})`);
  setElText("statusCount-cancelled", `(${scoped.filter(t => t.status === "cancelled").length})`);

  // Severity Tab Dynamic Counts
  setElText("sevCount-all", `(${scoped.length})`);
  setElText("sevCount-Critical", `(${scoped.filter(t => t.severity === "Critical").length})`);
  setElText("sevCount-High", `(${scoped.filter(t => t.severity === "High").length})`);
  setElText("sevCount-Medium", `(${scoped.filter(t => t.severity === "Medium").length})`);
  setElText("sevCount-Low", `(${scoped.filter(t => t.severity === "Low").length})`);
}

function getFilteredTasks() {
  const scoped = getScopedTasks();

  return scoped.filter(t => {
    // 1. Status filter
    if (activeStatusFilter !== "all" && t.status !== activeStatusFilter) return false;

    // 2. Severity filter
    if (activeSeverityFilter !== "all" && t.severity !== activeSeverityFilter) return false;

    // 3. Type multi-select filter
    if (activeTypeFilters.size === 0) {
      return false; // Nothing selected
    }
    if (activeTypeFilters.size < ALL_TYPE_KEYS.length) {
      const taskTypes = t.types || [];
      const hasMatchingType = taskTypes.some(typeKey => activeTypeFilters.has(typeKey));
      if (!hasMatchingType) return false;
    }

    // 4. Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match = t.id.toLowerCase().includes(q) ||
                    t.title.toLowerCase().includes(q) ||
                    t.file.toLowerCase().includes(q) ||
                    (t.solution && t.solution.toLowerCase().includes(q)) ||
                    (t.testScenario && t.testScenario.toLowerCase().includes(q)) ||
                    (t.technicalAnalysis && t.technicalAnalysis.toLowerCase().includes(q)) ||
                    (t.types && t.types.some(k => {
                      const info = ISSUE_TYPES[k];
                      return k.toLowerCase().includes(q) ||
                             (info && (info.label.toLowerCase().includes(q) || info.enLabel.toLowerCase().includes(q)));
                    }));
      if (!match) return false;
    }

    return true;
  });
}

// 10. Render Jira / Excel Table Rows
function renderTableRows() {
  const tbody = document.getElementById("taskTableBody");
  const countEl = document.getElementById("filteredCount");
  const filtered = getFilteredTasks();
  const scoped = getScopedTasks();

  if (countEl) countEl.textContent = `${filtered.length} من ${scoped.length} تاسك`;

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="px-6 py-12 text-center text-slate-400 font-medium text-sm">
          لا توجد تاسكات مطابقة للفلتر والتصنيفات المحددة
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = filtered.map((t) => {
    const sevBadge = {
      Critical: "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30",
      High: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/30",
      Medium: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30",
      Low: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/30"
    }[t.severity] || "bg-slate-50 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700/60";

    const typeBadges = (t.types || []).map(typeKey => {
      const info = ISSUE_TYPES[typeKey] || {
        label: typeKey,
        enLabel: typeKey,
        icon: "🏷️",
        badgeClass: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700/60"
      };
      return `
        <span class="text-[10.5px] px-1.5 py-0.5 rounded border font-bold inline-flex items-center gap-1 shrink-0 ${info.badgeClass}" title="${info.label}">
          <span>${info.icon}</span>
          <span>${info.enLabel}</span>
        </span>`;
    }).join("");

    // Dual Platform Cards (Compact: Mobile & Back - No Emojis)
    const isMobile = t.culprit === "Mobile" || t.culprit === "Both" || !t.culprit;
    const isBackend = Boolean(t.requiresBackend || t.culprit === "Backend" || t.culprit === "Both");

    const mobileCard = `
      <div class="flex-1 py-0.5 px-1.5 rounded text-[10.5px] font-bold border text-center whitespace-nowrap transition ${
        isMobile
          ? "bg-indigo-50 text-indigo-700 border-indigo-200 shadow-xs dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800/70"
          : "bg-slate-50 text-slate-300 border-slate-200/60 dark:bg-slate-900/40 dark:text-slate-600 dark:border-slate-800/50"
      }">
        Mobile
      </div>
    `;

    const backendCard = `
      <div class="flex-1 py-0.5 px-1.5 rounded text-[10.5px] font-bold border text-center whitespace-nowrap transition ${
        isBackend
          ? "bg-rose-50 text-rose-700 border-rose-200 shadow-xs dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/70"
          : "bg-slate-50 text-slate-300 border-slate-200/60 dark:bg-slate-900/40 dark:text-slate-600 dark:border-slate-800/50"
      }">
        Back
      </div>
    `;

    return `
      <tr class="border-b border-slate-200 dark:border-slate-800/60 hover:bg-slate-50/90 dark:hover:bg-slate-800/30 transition text-slate-800 dark:text-slate-200 align-top">
        
        <!-- 1. ID & Status -->
        <td class="px-3 py-4 w-40 whitespace-nowrap">
          <div class="font-mono text-xs font-black text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-1">
            <span class="text-slate-400 dark:text-slate-500">#</span><span>${t.id}</span>
          </div>
          <select onchange="setTaskStatus('${t.id}', this.value)"
                  class="w-full text-xs font-bold rounded-lg px-2.5 py-1.5 border outline-none cursor-pointer shadow-sm transition ${getStatusSelectClasses(t.status)}">
            <option value="pending" ${t.status === "pending" ? "selected" : ""}>⏳ Pending</option>
            <option value="in_progress" ${t.status === "in_progress" ? "selected" : ""}>🔄 In Progress</option>
            <option value="done" ${t.status === "done" ? "selected" : ""}>✅ Done</option>
            <option value="archived" ${t.status === "archived" ? "selected" : ""}>📦 Archived</option>
            <option value="cancelled" ${t.status === "cancelled" ? "selected" : ""}>❌ Cancelled</option>
          </select>
        </td>

        <!-- 2. Title, Severity & File + Copy Button -->
        <td class="px-4 py-4 min-w-[260px] max-w-[340px]">
          <div class="flex items-center gap-1.5 mb-2">
            <span class="text-[11px] px-2 py-0.5 rounded border font-bold ${sevBadge}">${t.severity}</span>
          </div>
          <div class="font-bold text-[14.5px] text-slate-900 dark:text-slate-100 mb-2 leading-normal">${t.title}</div>
          
          <!-- File & Copy button -->
          <div class="flex items-start justify-between gap-1.5 font-mono text-[11px] text-slate-700 dark:text-slate-300 bg-slate-100/90 dark:bg-slate-800/60 px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-700/60 group max-w-full" dir="ltr">
            <span class="select-all break-all leading-tight">📁 ${t.file}</span>
            <button onclick="copyText('${t.file}', this)"
                    title="نسخ مسار وسطر الملف"
                    class="p-0.5 text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-700 rounded transition flex items-center shrink-0 mt-0.5">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
            </button>
          </div>
        </td>

        <!-- 3. Dual Platform Cards (Compact: Mobile / Back) & Issue Types -->
        <td class="px-3 py-4 w-44 min-w-[150px]">
          <div class="space-y-2.5">
            <!-- Platform Cards Row -->
            <div class="flex items-center gap-1.5 w-full">
              ${mobileCard}
              ${backendCard}
            </div>
            
            <!-- Category / Issue Types Box with Light Border -->
            <div class="bg-slate-50/80 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 rounded-lg p-1.5 flex flex-wrap gap-1 items-center">
              ${typeBadges}
            </div>
          </div>
        </td>

        <!-- 4. Test Scenario & Business Impact -->
        <td class="px-4 py-4 min-w-[250px] text-[13.5px] leading-[1.8] text-slate-800 dark:text-white bg-slate-50/40 dark:bg-slate-900/20 border-x border-slate-100 dark:border-slate-800/60">
          <div class="whitespace-pre-line">${renderFormattedText(t.testScenario || '')}</div>
        </td>

        <!-- 5. Technical Root Cause -->
        <td class="px-4 py-4 min-w-[240px] text-[13px] leading-[1.8] text-slate-800 dark:text-white bg-slate-100/50 dark:bg-slate-900/40 border-e border-slate-200 dark:border-slate-800/60">
          <div class="whitespace-pre-line">${t.technicalAnalysis ? renderFormattedText(t.technicalAnalysis) : '<span class="text-slate-400 dark:text-slate-500 italic">غير محدد</span>'}</div>
        </td>

        <!-- 6. Solution & Code Block -->
        <td class="px-4 py-4 min-w-[300px] text-[13.5px] leading-[1.8] text-slate-800 dark:text-white">
          <div>${renderFormattedText(t.solution || '')}</div>
        </td>
      </tr>
    `;
  }).join("");
}

function getStatusSelectClasses(status) {
  switch (status) {
    case "done": return "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/60";
    case "in_progress": return "bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800/60";
    case "archived": return "bg-purple-50 text-purple-700 border-purple-300 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800/60";
    case "cancelled": return "bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700";
    default: return "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/60";
  }
}

// 11. Markdown & Code Block Formatter
function renderFormattedText(text) {
  if (!text) return "";
  
  let formatted = escapeHtml(text);

  // Multiline Code Blocks: ```lang ... ```
  formatted = formatted.replace(/```(?:dart|json|sql|js)?\n([\s\S]*?)```/g, (match, code) => {
    return `<pre class="bg-slate-900 dark:bg-slate-950 text-emerald-400 p-3 rounded-lg text-xs font-mono my-2.5 overflow-x-auto border border-slate-800 leading-normal select-all" dir="ltr"><code dir="ltr">${code.trim()}</code></pre>`;
  });

  // Inline Code: `...`
  formatted = formatted.replace(/`([^`]+)`/g, '<code class="bg-slate-100 dark:bg-slate-800/80 text-slate-800 dark:text-white px-1.5 py-0.5 rounded text-[11.5px] font-mono border border-slate-200/80 dark:border-slate-700/60 inline-block font-medium" dir="ltr">$1</code>');

  return formatted;
}

function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// 12. Event Listeners
document.addEventListener("DOMContentLoaded", () => {
  initApp();

  // Search input
  document.getElementById("searchInput")?.addEventListener("input", (e) => {
    searchQuery = e.target.value;
    updateDashboard();
  });

  // Module filter
  document.getElementById("moduleFilter")?.addEventListener("change", (e) => {
    activeModuleFilter = e.target.value;
    updateDashboard();
  });

  // Culprit filter
  document.getElementById("culpritFilter")?.addEventListener("change", (e) => {
    activeCulpritFilter = e.target.value;
    updateDashboard();
  });

  // Module Dropdown Toggle
  const moduleDropdownBtn = document.getElementById("moduleDropdownBtn");
  const moduleDropdownMenu = document.getElementById("moduleDropdownMenu");
  const moduleDropdownChevron = document.getElementById("moduleDropdownChevron");

  if (moduleDropdownBtn && moduleDropdownMenu) {
    moduleDropdownBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isHidden = moduleDropdownMenu.classList.contains("hidden");
      if (isHidden) {
        moduleDropdownMenu.classList.remove("hidden");
        moduleDropdownChevron?.classList.add("rotate-180");
      } else {
        moduleDropdownMenu.classList.add("hidden");
        moduleDropdownChevron?.classList.remove("rotate-180");
      }
    });

    document.addEventListener("click", (e) => {
      if (!moduleDropdownMenu.contains(e.target) && !moduleDropdownBtn.contains(e.target)) {
        moduleDropdownMenu.classList.add("hidden");
        moduleDropdownChevron?.classList.remove("rotate-180");
      }
    });
  }

  // Type Dropdown Toggle
  const typeDropdownBtn = document.getElementById("typeDropdownBtn");
  const typeDropdownMenu = document.getElementById("typeDropdownMenu");
  const typeDropdownChevron = document.getElementById("typeDropdownChevron");

  if (typeDropdownBtn && typeDropdownMenu) {
    typeDropdownBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isHidden = typeDropdownMenu.classList.contains("hidden");
      if (isHidden) {
        typeDropdownMenu.classList.remove("hidden");
        typeDropdownChevron?.classList.add("rotate-180");
      } else {
        typeDropdownMenu.classList.add("hidden");
        typeDropdownChevron?.classList.remove("rotate-180");
      }
    });

    // Close when clicking outside
    document.addEventListener("click", (e) => {
      if (!typeDropdownMenu.contains(e.target) && !typeDropdownBtn.contains(e.target)) {
        typeDropdownMenu.classList.add("hidden");
        typeDropdownChevron?.classList.remove("rotate-180");
      }
    });
  }

  // Select All / Deselect All Buttons in Dropdown
  document.getElementById("selectAllTypesBtn")?.addEventListener("click", () => {
    toggleAllTypes(true);
  });

  document.getElementById("deselectAllTypesBtn")?.addEventListener("click", () => {
    toggleAllTypes(false);
  });

  // Status Filter Buttons
  document.querySelectorAll("[data-status-filter]").forEach(btn => {
    btn.addEventListener("click", () => {
      activeStatusFilter = btn.getAttribute("data-status-filter");
      syncControlsFromState();
      updateDashboard();
    });
  });

  // Severity Filter Buttons
  document.querySelectorAll("[data-severity-filter]").forEach(btn => {
    btn.addEventListener("click", () => {
      activeSeverityFilter = btn.getAttribute("data-severity-filter");
      syncControlsFromState();
      updateDashboard();
    });
  });
});
