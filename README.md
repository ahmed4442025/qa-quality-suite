# QA Quality Suite

An end-to-end quality assurance workflow for AI coding agents.

QA Quality Suite bundles four coordinated skills that initialize a QA workspace, audit application modules, turn findings into structured tasks, and apply verified fixes. The skills share the same dashboard and reporting format, so they are designed to be installed and used together.

## Install

Install the complete suite for every detected agent:

```bash
npx skills add GITHUB_OWNER/qa-quality-suite --all
```

Install the complete suite globally for Codex only:

```bash
npx skills add GITHUB_OWNER/qa-quality-suite --skill "*" --agent codex -g -y
```

Replace `GITHUB_OWNER` with the repository owner's GitHub username or organization.

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

## Requirements

- Node.js with `npx`
- An Agent Skills-compatible coding agent
- A project workspace the agent can inspect and edit

## Updating

Pull the latest installed versions with:

```bash
npx skills update
```
