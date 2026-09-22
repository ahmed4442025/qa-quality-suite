#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const RESTRICTED_FIELDS = new Set([
  "file",
  "technicalAnalysis",
  "solution",
  "requiresBackend",
  "requiresFrontend",
]);

function argument(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1]
    ? path.resolve(process.argv[index + 1])
    : fallback;
}

function taskIds(markdown) {
  const ids = [];
  const seen = new Set();
  for (const rawLine of markdown.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(line)) {
      throw new Error(`Invalid line in done.md: ${line}`);
    }
    if (!seen.has(line)) {
      seen.add(line);
      ids.push(line);
    }
  }
  return ids;
}

function manifestSources(dashboardRoot) {
  const dataRoot = path.join(dashboardRoot, "data");
  const manifestPath = path.join(dataRoot, "manifest.js");
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Dashboard manifest was not found: ${manifestPath}`);
  }
  const manifest = fs.readFileSync(manifestPath, "utf8");
  const sources = [];
  const seen = new Set();
  const pattern = /["'](data[\\/][^"']+\.js)["']/g;
  let match;
  while ((match = pattern.exec(manifest))) {
    const file = path.resolve(dashboardRoot, match[1]);
    const relative = path.relative(dataRoot, file);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error(`Unsafe path in dashboard manifest: ${match[1]}`);
    }
    if (!seen.has(file)) {
      seen.add(file);
      sources.push(file);
    }
  }
  if (!sources.length) {
    throw new Error("No data files are registered in qa_dashboard/data/manifest.js");
  }
  return sources;
}

function modulesFromFile(file) {
  if (!fs.existsSync(file)) throw new Error(`Dashboard data file was not found: ${file}`);
  const sandbox = { window: Object.create(null) };
  vm.runInNewContext(fs.readFileSync(file, "utf8"), sandbox, {
    filename: file,
    timeout: 1000,
    contextCodeGeneration: { strings: false, wasm: false },
  });
  return Object.entries(sandbox.window)
    .filter(([key, value]) => key.startsWith("MODULE_") && value && typeof value === "object")
    .map(([, value]) => value);
}

function publicPlatform(task) {
  const source = String(task.culprit || "");
  const backend = ["Backend", "Database", "ThirdParty"].includes(source);
  const frontend = ["Mobile", "Frontend"].includes(source) || !source;
  if (source === "Both" || (frontend && task.requiresBackend)) return "Both";
  if (backend) return "Backend";
  return "Mobile";
}

function publicTask(task) {
  const result = {
    id: String(task.id || ""),
    title: String(task.title || "مشكلة بدون عنوان"),
    types:
      Array.isArray(task.types) && task.types.length
        ? [...new Set(task.types.map(String))]
        : [String(task.type || "bug")],
    severity: String(task.severity || "Medium"),
    culprit: publicPlatform(task),
    status: "done",
    testScenario: String(task.testScenario || ""),
  };
  for (const field of RESTRICTED_FIELDS) delete result[field];
  return result;
}

function collectFindings(dashboardRoot) {
  const findings = new Map();
  for (const source of manifestSources(dashboardRoot)) {
    for (const module of modulesFromFile(source)) {
      if (!Array.isArray(module.tasks)) continue;
      for (const task of module.tasks) {
        if (!task || typeof task !== "object" || !task.id) continue;
        const id = String(task.id);
        if (findings.has(id)) {
          throw new Error(
            `Finding ID ${id} is duplicated in ${findings.get(id).source} and ${source}`,
          );
        }
        findings.set(id, {
          source,
          moduleId: String(module.moduleId || "general"),
          moduleName: String(module.moduleName || module.moduleId || "الوحدة العامة"),
          task,
        });
      }
    }
  }
  return findings;
}

function completedSource(groups) {
  const header = [
    "/**",
    " * Generated from qa_dashboard/done.md by sync-report.ps1.",
    " * PM-safe output: engineering-only fields are intentionally omitted.",
    " */",
  ].join("\n");
  const bodies = [...groups.values()].map((group, index) => {
    const payload = {
      moduleId: group.moduleId,
      moduleName: group.moduleName,
      tasks: group.tasks,
    };
    return `window.MODULE_REPORT_${index + 1} = ${JSON.stringify(payload, null, 2)};`;
  });
  return `${header}\n${bodies.join("\n\n")}\n`;
}

function manifestSource() {
  return `/** Generated report manifest. */\n[\n  "data/completed.js"\n].forEach(function (file) {\n  document.write('<script src="' + file + '"><\\/script>');\n});\n`;
}

function writeUtf8(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, content, "utf8");
  try {
    fs.renameSync(temporary, file);
  } catch (error) {
    if (!fs.existsSync(temporary)) throw error;
    fs.copyFileSync(temporary, file);
    fs.unlinkSync(temporary);
  }
}

function syncReport(dashboardRoot, reportRoot) {
  const donePath = path.join(dashboardRoot, "done.md");
  if (!fs.existsSync(donePath)) throw new Error(`done.md was not found: ${donePath}`);
  const ids = taskIds(fs.readFileSync(donePath, "utf8"));
  const findings = collectFindings(dashboardRoot);
  const missing = ids.filter((id) => !findings.has(id));
  if (missing.length) {
    throw new Error(`IDs from done.md were not found in active dashboard data: ${missing.join(", ")}`);
  }

  const groups = new Map();
  for (const id of ids) {
    const finding = findings.get(id);
    if (!groups.has(finding.moduleId)) {
      groups.set(finding.moduleId, {
        moduleId: finding.moduleId,
        moduleName: finding.moduleName,
        tasks: [],
      });
    }
    groups.get(finding.moduleId).tasks.push(publicTask(finding.task));
  }

  const dataRoot = path.join(reportRoot, "data");
  writeUtf8(path.join(dataRoot, "completed.js"), completedSource(groups));
  writeUtf8(path.join(dataRoot, "manifest.js"), manifestSource());
  return { issues: ids.length, modules: groups.size };
}

if (require.main === module) {
  const dashboardRoot = argument(
    "--dashboard",
    path.resolve(__dirname, "..", ".."),
  );
  const reportRoot = argument(
    "--report",
    path.resolve(dashboardRoot, "..", "qa_report"),
  );
  try {
    const result = syncReport(dashboardRoot, reportRoot);
    process.stdout.write(
      `PM report updated: ${result.issues} completed findings from ${result.modules} modules.\n`,
    );
  } catch (error) {
    process.stderr.write(`Report sync failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  collectFindings,
  publicTask,
  syncReport,
  taskIds,
};
