# QA Quality Suite

An end-to-end quality assurance workflow for AI coding agents.

QA Quality Suite bundles four coordinated skills that initialize a QA workspace, audit application modules, turn findings into structured tasks, and apply verified fixes. The skills share the same dashboard and reporting format, so they are designed to be installed and used together.

## Install

Install the complete suite for every detected agent:

```bash
npx skills add ahmed4442025/qa-quality-suite --all
```

Install the complete suite globally for Codex only:

```bash
npx skills add ahmed4442025/qa-quality-suite --skill "*" --agent codex -g -y
```

## Included skills

| Skill | Purpose |
| --- | --- |
| `qa-init` | Creates the developer dashboard, client report, module checklist, and QA tracking files. |
| `qa-audit` | Performs phased architecture, code, UI, and UX audits for mobile application modules. |
| `qa-audit-laravel` | Performs phased architecture, security, database, API, and performance audits for Laravel modules. |
| `qa-solve` | Implements fixes for selected QA findings and updates their dashboard status. |

## Workflow

```text
qa-init  ->  qa-audit / qa-audit-laravel  ->  qa-solve
 setup              inspect                    fix
```

1. Run `/qa-init` once in the target project.
2. Run `/qa-audit` or `/qa-audit-laravel` for one module at a time.
3. Review the generated findings in `qa_dashboard` and `qa_report`.
4. Run `/qa-solve` with one or more finding IDs to implement and track the fixes.

## Repository structure

```text
skills/
  qa-init/
  qa-audit/
  qa-audit-laravel/
  qa-solve/
```

Each directory is a standalone Agent Skill, while the suite provides the shared workflow and supporting dashboard templates required to use them together.

## Miyar developer dashboard

The `qa_dashboard` template includes the Miyar (مِعيار) interface: Arabic RTL layouts, light/dark themes, actionable priority summaries, searchable issue lists, a detail panel, and a full-detail report view. On small screens the list becomes issue cards. Filters, sorting, pagination, and the selected issue persist in the URL.

Replaceable UI and application logic live under `qa_dashboard/app`, while project-owned `config.js`, `data/`, `modules.md`, and `done.md` remain outside it. Re-running `/qa-init` on an existing project asks whether to update the runtime, refresh the module checklist, do both, or cancel. Runtime comparison occurs only after the user chooses an update that needs it.

Run `qa_dashboard/run.bat` on Windows to view the dashboard and save status changes directly to its existing module files. Status changes are confirmed by the server and can be undone. The `MODULE_*` data schema and `/api/status` endpoint are unchanged. No package installation or build step is needed to run the dashboard; CSS and JavaScript ship with the template. Google Fonts is optional, with local font fallbacks.

For dashboard development checks, run `npm install` followed by `npm test` at the suite root. Tests cover data compatibility, filtering, pagination, rendering, status persistence and undo, failure feedback, and text-color contrast. DOM tests do not replace browser layout or native keyboard/accessibility testing.

## Requirements

- Node.js with `npx`
- An Agent Skills-compatible coding agent
- A project workspace the agent can inspect and edit

## Updating

Pull the latest installed versions with:

```bash
npx skills update
```
