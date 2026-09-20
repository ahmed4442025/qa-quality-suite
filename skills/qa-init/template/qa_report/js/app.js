/**
 * FieldOps QA Studio - Modern Controller & Filter Engine
 * 100% Offline, Zero Dependency, Safe Architecture
 */

// ==========================================
// 1. Issue Types Configuration & Metadata
// ==========================================
const ISSUE_TYPES = {
  bug: {
    id: "bug",
    label: "خطأ برمجي",
    enLabel: "Bug",
    icon: "🐛",
    cssTypeClass: "type-bug"
  },
  security: {
    id: "security",
    label: "أمان وجلسات",
    enLabel: "Security",
    icon: "🔒",
    cssTypeClass: "type-security"
  },
  ux: {
    id: "ux",
    label: "تجربة مستخدم",
    enLabel: "UX",
    icon: "💡",
    cssTypeClass: "type-ux"
  },
  perf: {
    id: "perf",
    label: "أداء وسرعة",
    enLabel: "Perf",
    icon: "⚡",
    cssTypeClass: "type-perf"
  },
  ui: {
    id: "ui",
    label: "واجهة وتصميم",
    enLabel: "UI",
    icon: "🎨",
    cssTypeClass: "type-ui"
  },
  suggest: {
    id: "suggest",
    label: "اقتراح تحسين",
    enLabel: "Suggest",
    icon: "✨",
    cssTypeClass: "type-suggest"
  },
  refactor: {
    id: "refactor",
    label: "معايير وهيكلة",
    enLabel: "Refactor",
    icon: "⚙️",
    cssTypeClass: "type-refactor"
  }
};

// ==========================================
// 2. Severity Configuration
// ==========================================
const SEVERITY_CONFIG = {
  Critical: {
    id: "Critical",
    label: "حرجة جداً",
    enLabel: "Critical",
    cssClass: "sev-critical"
  },
  High: {
    id: "High",
    label: "عالية",
    enLabel: "High",
    cssClass: "sev-high"
  },
  Medium: {
    id: "Medium",
    label: "متوسطة",
    enLabel: "Medium",
    cssClass: "sev-medium"
  },
  Low: {
    id: "Low",
    label: "منخفضة",
    enLabel: "Low",
    cssClass: "sev-low"
  }
};

const ALL_TYPE_KEYS = Object.keys(ISSUE_TYPES);
const ALL_SEVERITY_KEYS = Object.keys(SEVERITY_CONFIG);

// State Management
let allTasks = [];
let searchQuery = "";
let activeModuleFilter = "all";
let activeTypeFilters = new Set(ALL_TYPE_KEYS);
let activeSeverityFilters = new Set(ALL_SEVERITY_KEYS);

// Double-click chip debounce timers
let typeChipTimer = null;
let lastClickedType = null;
let sevChipTimer = null;
let lastClickedSev = null;

// ==========================================
// 3. Theme Manager (Dark / Light)
// ==========================================
const ThemeManager = {
  THEME_KEY: "fieldops_qa_theme",

  init() {
    let savedTheme = null;
    try {
      savedTheme = localStorage.getItem(this.THEME_KEY);
    } catch (e) {
      console.warn("LocalStorage unavailable", e);
    }

    if (!savedTheme) {
      const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
      savedTheme = prefersDark ? "dark" : "light";
    }

    this.applyTheme(savedTheme);

    const toggleBtn = document.getElementById("themeToggleBtn");
    if (toggleBtn) {
      toggleBtn.addEventListener("click", () => this.toggleTheme());
    }
  },

  applyTheme(theme) {
    const isDark = theme === "dark";
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }

    const darkIcon = document.getElementById("themeIconDark");
    const lightIcon = document.getElementById("themeIconLight");
    const label = document.getElementById("themeToggleLabel");

    if (darkIcon && lightIcon && label) {
      if (isDark) {
        darkIcon.style.display = "none";
        lightIcon.style.display = "block";
        label.textContent = "الوضع الفاتح";
      } else {
        darkIcon.style.display = "block";
        lightIcon.style.display = "none";
        label.textContent = "الوضع الداكن";
      }
    }

    try {
      localStorage.setItem(this.THEME_KEY, theme);
    } catch (e) {}
  },

  toggleTheme() {
    const isCurrentlyDark = document.documentElement.classList.contains("dark");
    this.applyTheme(isCurrentlyDark ? "light" : "dark");
  }
};

// ==========================================
// 4. Application Bootstrapper
// ==========================================
function initApp() {
  ThemeManager.init();
  loadTasksFromModules();
  renderModuleOptions();
  renderTypeChips();
  renderSeverityChips();
  updateDashboard();
  setupGlobalKeyboardShortcuts();
}

// ==========================================
// 5. Load & Normalize Tasks
// ==========================================
function loadTasksFromModules() {
  allTasks = [];
  const moduleKeys = Object.keys(window).filter(k => k.startsWith("MODULE_"));

  moduleKeys.forEach(k => {
    const mod = window[k];
    if (mod && Array.isArray(mod.tasks)) {
      mod.tasks.forEach(t => {
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
          severity: t.severity || "Medium",
          moduleId: mod.moduleId || "general",
          moduleName: mod.moduleName || "الموديول العام"
        });
      });
    }
  });

  const headerCountEl = document.getElementById("headerTasksCount");
  if (headerCountEl) {
    headerCountEl.textContent = `${allTasks.length} فحص معتمد`;
  }
}

// ==========================================
// 6. Populate Module Options
// ==========================================
function renderModuleOptions() {
  const select = document.getElementById("moduleFilter");
  if (!select) return;

  const modulesMap = new Map();
  allTasks.forEach(t => {
    if (!modulesMap.has(t.moduleId)) {
      modulesMap.set(t.moduleId, { id: t.moduleId, name: t.moduleName, count: 0 });
    }
    modulesMap.get(t.moduleId).count++;
  });

  const modules = Array.from(modulesMap.values());
  select.innerHTML = `<option value="all">كل الموديولات (${allTasks.length})</option>` +
    modules.map(m => `<option value="${escapeHtml(m.id)}">${escapeHtml(m.name)} (${m.count})</option>`).join("");
}

// ==========================================
// 7. Render Type Filter Controls
// ==========================================
function renderTypeChips() {
  const container = document.getElementById("typeChipsContainer");
  if (!container) return;

  const counts = getTypeCounts();
  const isAllSelected = activeTypeFilters.size === ALL_TYPE_KEYS.length;

  const allChipHtml = `
    <button type="button" onclick="toggleAllTypes(true)"
            title="إظهار كل التصنيفات"
            class="filter-chip ${isAllSelected ? "active" : ""}">
      <span>الكل</span>
      <span class="chip-counter">(${allTasks.length})</span>
    </button>
  `;

  const typeChipsHtml = ALL_TYPE_KEYS.map(key => {
    const info = ISSUE_TYPES[key];
    const isSelected = activeTypeFilters.has(key);
    const count = counts[key] || 0;

    return `
      <button type="button"
              onclick="handleTypeChipClick('${key}', event)"
              ondblclick="selectOnlyThisType('${key}', event)"
              title="نقرة: تبديل | نقرتان: حصر هذا النوع"
              class="filter-chip ${info.cssTypeClass} ${isSelected ? "active" : ""}">
        <span>${escapeHtml(info.enLabel)}</span>
        <span class="chip-counter">(${count})</span>
      </button>
    `;
  }).join("");

  container.innerHTML = allChipHtml + typeChipsHtml;
}

function getTypeCounts() {
  const counts = {};
  ALL_TYPE_KEYS.forEach(k => counts[k] = 0);
  allTasks.forEach(t => {
    if (Array.isArray(t.types)) {
      t.types.forEach(typeKey => {
        if (counts[typeKey] !== undefined) counts[typeKey]++;
      });
    }
  });
  return counts;
}

function handleTypeChipClick(typeKey, event) {
  if (event) event.preventDefault();

  if (typeChipTimer && lastClickedType === typeKey) {
    clearTimeout(typeChipTimer);
    typeChipTimer = null;
    lastClickedType = null;
    selectOnlyThisType(typeKey);
  } else {
    if (typeChipTimer) clearTimeout(typeChipTimer);
    lastClickedType = typeKey;
    typeChipTimer = setTimeout(() => {
      toggleSingleTypeFilter(typeKey);
      typeChipTimer = null;
      lastClickedType = null;
    }, 220);
  }
}

function selectOnlyThisType(typeKey, event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  if (typeChipTimer) {
    clearTimeout(typeChipTimer);
    typeChipTimer = null;
    lastClickedType = null;
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
  renderTypeChips();
  updateDashboard();
}

// ==========================================
// 8. Render Severity Filter Controls
// ==========================================
function renderSeverityChips() {
  const container = document.getElementById("severityChipsContainer");
  if (!container) return;

  const counts = getSeverityCounts();
  const isAllSelected = activeSeverityFilters.size === ALL_SEVERITY_KEYS.length;

  const allChipHtml = `
    <button type="button" onclick="toggleAllSeverities(true)"
            title="إظهار كافة مستويات الخطورة"
            class="filter-chip ${isAllSelected ? "active" : ""}">
      <span>الكل</span>
      <span class="chip-counter">(${allTasks.length})</span>
    </button>
  `;

  const severityChipsHtml = ALL_SEVERITY_KEYS.map(key => {
    const info = SEVERITY_CONFIG[key];
    const isSelected = activeSeverityFilters.has(key);
    const count = counts[key] || 0;

    return `
      <button type="button"
              onclick="handleSeverityChipClick('${key}', event)"
              ondblclick="selectOnlyThisSeverity('${key}', event)"
              title="نقرة: تبديل | نقرتان: حصر هذا المستوى"
              class="filter-chip ${info.cssClass} ${isSelected ? "active" : ""}">
        <span class="sev-badge-dot"></span>
        <span>${escapeHtml(info.label)}</span>
        <span class="chip-counter">(${count})</span>
      </button>
    `;
  }).join("");

  container.innerHTML = allChipHtml + severityChipsHtml;
}

function getSeverityCounts() {
  const counts = {};
  ALL_SEVERITY_KEYS.forEach(k => counts[k] = 0);
  allTasks.forEach(t => {
    const sev = t.severity || "Medium";
    if (counts[sev] !== undefined) counts[sev]++;
  });
  return counts;
}

function handleSeverityChipClick(sevKey, event) {
  if (event) event.preventDefault();

  if (sevChipTimer && lastClickedSev === sevKey) {
    clearTimeout(sevChipTimer);
    sevChipTimer = null;
    lastClickedSev = null;
    selectOnlyThisSeverity(sevKey);
  } else {
    if (sevChipTimer) clearTimeout(sevChipTimer);
    lastClickedSev = sevKey;
    sevChipTimer = setTimeout(() => {
      toggleSingleSeverityFilter(sevKey);
      sevChipTimer = null;
      lastClickedSev = null;
    }, 220);
  }
}

function selectOnlyThisSeverity(sevKey, event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  if (sevChipTimer) {
    clearTimeout(sevChipTimer);
    sevChipTimer = null;
    lastClickedSev = null;
  }
  activeSeverityFilters = new Set([sevKey]);
  onSeverityFilterChange();
}

function toggleSingleSeverityFilter(sevKey) {
  if (activeSeverityFilters.has(sevKey)) {
    activeSeverityFilters.delete(sevKey);
  } else {
    activeSeverityFilters.add(sevKey);
  }
  onSeverityFilterChange();
}

function toggleAllSeverities(selectAll) {
  if (selectAll) {
    activeSeverityFilters = new Set(ALL_SEVERITY_KEYS);
  } else {
    activeSeverityFilters.clear();
  }
  onSeverityFilterChange();
}

function onSeverityFilterChange() {
  renderSeverityChips();
  updateDashboard();
}

// ==========================================
// 9. Reset All Filters
// ==========================================
function resetAllFilters() {
  searchQuery = "";
  const searchInput = document.getElementById("searchInput");
  if (searchInput) searchInput.value = "";

  const searchClearBtn = document.getElementById("searchClearBtn");
  if (searchClearBtn) searchClearBtn.style.display = "none";

  activeModuleFilter = "all";
  const moduleSelect = document.getElementById("moduleFilter");
  if (moduleSelect) moduleSelect.value = "all";

  activeTypeFilters = new Set(ALL_TYPE_KEYS);
  activeSeverityFilters = new Set(ALL_SEVERITY_KEYS);

  renderTypeChips();
  renderSeverityChips();
  updateDashboard();
  showToast("تمت استعادة كافة الفلاتر الافتراضية");
}

// ==========================================
// 10. Filter Engine
// ==========================================
function getFilteredTasks() {
  return allTasks.filter(t => {
    // 1. Module
    if (activeModuleFilter !== "all" && t.moduleId !== activeModuleFilter) {
      return false;
    }

    // 2. Severity
    if (activeSeverityFilters.size === 0) return false;
    const taskSev = t.severity || "Medium";
    if (!activeSeverityFilters.has(taskSev)) return false;

    // 3. Types
    if (activeTypeFilters.size === 0) return false;
    if (activeTypeFilters.size < ALL_TYPE_KEYS.length) {
      const taskTypes = t.types || [];
      const matchType = taskTypes.some(k => activeTypeFilters.has(k));
      if (!matchType) return false;
    }

    // 4. Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        (t.id && t.id.toLowerCase().includes(q)) ||
        (t.title && t.title.toLowerCase().includes(q)) ||
        (t.testScenario && t.testScenario.toLowerCase().includes(q)) ||
        (t.severity && t.severity.toLowerCase().includes(q)) ||
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

// ==========================================
// 11. Render Presentation Table Rows
// ==========================================
function updateDashboard() {
  const tbody = document.getElementById("taskTableBody");
  const countEl = document.getElementById("filteredCount");
  const filtered = getFilteredTasks();

  if (countEl) {
    countEl.textContent = `${filtered.length} من ${allTasks.length} فحص`;
  }

  if (!tbody) return;

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6">
          <div class="empty-state">
            <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              <line x1="8" y1="11" x2="14" y2="11"></line>
            </svg>
            <div class="empty-state-title">لا توجد فحوصات مطابقة للبحث أو التصفية</div>
            <div class="empty-state-desc">جرب تعديل كلمات البحث أو تفعيل خيارات الفلاتر بالأعلى</div>
          </div>
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = filtered.map((t, index) => {
    const sev = SEVERITY_CONFIG[t.severity] || {
      label: t.severity || "عادية",
      enLabel: t.severity || "Normal",
      cssClass: "sev-medium"
    };

    const typeBadges = (t.types || []).map(typeKey => {
      const info = ISSUE_TYPES[typeKey] || {
        label: typeKey,
        enLabel: typeKey
      };
      return `
        <span class="category-tag tag-${typeKey}" title="${escapeHtml(info.label)}">
          <span>${escapeHtml(info.enLabel)}</span>
        </span>`;
    }).join("");

    return `
      <tr>
        <!-- 0. Index -->
        <td class="td-index">${index + 1}</td>

        <!-- 1. Task ID -->
        <td class="td-id">
          <button type="button" class="task-id-chip" onclick="copyToClipboard('${escapeJs(t.id)}', 'تم نسخ كود الفحص')" title="انقر لنسخ الكود">
            <span>#${escapeHtml(t.id)}</span>
          </button>
        </td>

        <!-- 2. Severity -->
        <td class="td-severity">
          <span class="sev-badge ${sev.cssClass}">
            <span class="sev-badge-dot"></span>
            <span>${escapeHtml(sev.label)}</span>
          </span>
        </td>

        <!-- 3. Title (المشكلة مع تمييز المصطلحات التقنية لمنع اللخبطة البصرية) -->
        <td class="td-title">
          <div class="task-title-text">${formatMixedTitle(t.title)}</div>
        </td>

        <!-- 4. Category Badges -->
        <td class="td-types">
          <div class="types-badge-container">
            ${typeBadges}
          </div>
        </td>

        <!-- 5. Test Scenario & Steps -->
        <td class="td-scenario">
          <div class="scenario-flat-list">
            ${renderScenarioSteps(t.testScenario)}
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

// ==========================================
// 12. Smart BiDi Mixed Title Formatter
// ==========================================
function formatMixedTitle(rawTitle) {
  if (!rawTitle) return "";
  let text = escapeHtml(rawTitle);

  // 1. Backticks: `code`
  text = text.replace(/`([^`]+)`/g, '<bdi class="tech-text">$1</bdi>');

  // 2. Parenthesized English/technical phrases: (Remember Me) -> <bdi class="tech-text">($1)</bdi>
  text = text.replace(/\(([A-Za-z0-9_#\-\.\/\s]+)\)/g, '<bdi class="tech-text">($1)</bdi>');

  // 3. Standalone English words & phrases (e.g. Network Layer, Interceptors, 401 Unauthorized, CancelToken)
  text = text.replace(/(?<!<[^>]*)\b([A-Za-z][A-Za-z0-9_\-\.\/]*(?:\s+[A-Za-z0-9_\-\.\/]+)*)\b(?![^<]*>)/g, (match) => {
    return `<bdi class="tech-text">${match}</bdi>`;
  });

  return text;
}

// ==========================================
// 13. Parse & Render Scenario Steps
// ==========================================
function renderScenarioSteps(rawText) {
  if (!rawText) return "";

  const lines = rawText.split("\n");
  let formattedHtml = "";
  let inCodeBlock = false;
  let codeBuffer = [];

  lines.forEach(line => {
    const trimmed = line.trim();

    // Code Block Delimiter
    if (trimmed.startsWith("```")) {
      if (inCodeBlock) {
        inCodeBlock = false;
        formattedHtml += `<pre class="code-block"><code>${escapeHtml(codeBuffer.join("\n"))}</code></pre>`;
        codeBuffer = [];
      } else {
        inCodeBlock = true;
        codeBuffer = [];
      }
      return;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      return;
    }

    if (!trimmed) return;

    // Check if line starts with numbered step: "1. ", "2. ", etc.
    const stepMatch = trimmed.match(/^(\d+)[\.\-\)]\s+(.*)/);
    if (stepMatch) {
      const stepNum = stepMatch[1];
      const stepContent = formatInlineCode(stepMatch[2]);
      formattedHtml += `
        <div class="scenario-step-line">
          <span class="step-num-text">${stepNum}.</span>
          <div class="step-body-text">${stepContent}</div>
        </div>
      `;
    } else {
      formattedHtml += `<div style="margin-bottom:0.35rem;">${formatInlineCode(trimmed)}</div>`;
    }
  });

  if (inCodeBlock && codeBuffer.length > 0) {
    formattedHtml += `<pre class="code-block"><code>${escapeHtml(codeBuffer.join("\n"))}</code></pre>`;
  }

  return formattedHtml;
}

function formatInlineCode(text) {
  if (!text) return "";
  let sanitized = escapeHtml(text);
  return sanitized.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
}

// ==========================================
// 14. Copy to Clipboard & Toast Helper
// ==========================================
function copyToClipboard(text, customMessage) {
  if (!text) return;

  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(() => {
      showToast(customMessage || "تم النسخ إلى الحافظة بنجاح");
    }).catch(() => fallbackCopy(text, customMessage));
  } else {
    fallbackCopy(text, customMessage);
  }
}

function fallbackCopy(text, customMessage) {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  try {
    document.execCommand("copy");
    showToast(customMessage || "تم النسخ إلى الحافظة بنجاح");
  } catch (err) {
    console.error("Copy failed", err);
  }
  document.body.removeChild(textArea);
}

let toastTimer = null;
function showToast(message) {
  const toast = document.getElementById("appToast");
  const toastMsg = document.getElementById("toastMessage");
  if (!toast || !toastMsg) return;

  toastMsg.textContent = message;
  toast.classList.add("show");

  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2200);
}

// ==========================================
// 15. HTML Safety Helpers
// ==========================================
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeJs(str) {
  if (!str) return "";
  return String(str).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

// ==========================================
// 16. Global Keyboard Shortcuts & Events
// ==========================================
function setupGlobalKeyboardShortcuts() {
  document.addEventListener("keydown", (e) => {
    // Focus search on '/' when not in input
    if (e.key === "/" && document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "TEXTAREA") {
      e.preventDefault();
      const searchInput = document.getElementById("searchInput");
      if (searchInput) {
        searchInput.focus();
        searchInput.select();
      }
    }
  });
}

// ==========================================
// 17. Event Listeners Setup
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  initApp();

  // Search input
  const searchInput = document.getElementById("searchInput");
  const searchClearBtn = document.getElementById("searchClearBtn");

  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      searchQuery = e.target.value;
      if (searchClearBtn) {
        searchClearBtn.style.display = searchQuery ? "block" : "none";
      }
      updateDashboard();
    });
  }

  if (searchClearBtn) {
    searchClearBtn.addEventListener("click", () => {
      if (searchInput) {
        searchInput.value = "";
        searchQuery = "";
        searchClearBtn.style.display = "none";
        searchInput.focus();
        updateDashboard();
      }
    });
  }

  // Module filter
  document.getElementById("moduleFilter")?.addEventListener("change", (e) => {
    activeModuleFilter = e.target.value;
    updateDashboard();
  });

  // Reset Filters
  document.getElementById("resetFiltersBtn")?.addEventListener("click", () => resetAllFilters());
});
