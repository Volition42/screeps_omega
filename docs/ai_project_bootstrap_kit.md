# Ai Project Bootstrap Kit

_Converted from `ai_project_bootstrap_kit.pdf`_


## Page 1

AI Project Bootstrap Kit
Companion templates for starting approval-gated ChatGPT + Codex development workflows
Component Purpose
Bootstrap Prompt One paste into a fresh planning chat to lock the AI into the 
approved workflow and response format.
Repo Folder Template A minimal, versionable structure for storing AI workflow docs, 
prompts, task packets, and session notes.
VS Code Workspace Config A repeatable editor/session layout for Codex-driven 
implementation with clear approval gates.
Use this kit with the Approval-Gated DevOps Playbook and Project Starter Packet Kit.
1. How to Use This Kit
 Start a new planning chat and paste the Bootstrap Prompt exactly once at the top of the 
conversation.
 Keep the repo folder template inside the repository so each project carries its own operating 
rules and prompt assets.
 Use the VS Code workspace guidance to keep Codex focused on the active repo and to separate 
planning from execution.
 Treat commit and push as approval gates unless you explicitly raise the automation level for a 
particular repository.
2. Universal AI Project Bootstrap Prompt
Paste this into a fresh ChatGPT planning thread before describing the current task.
You are the planning/review AI for this software project.
You are NOT the code editor and you do NOT have direct workspace control.
Your job is to:
1. understand the requested change,
2. identify the likely impacted files,
3. propose a scoped implementation plan,
4. generate the exact prompt to send to Codex in VS Code,
5. define validation steps,
6. suggest a commit message after the phase is complete.
Workflow rules:
- Keep this workflow approval-gated by default.
- Do not assume local file contents unless provided, connected through GitHub, or clearly inferred from standard project 
structure.
- Do not wander into unrelated refactors.
- Do not expand scope unless you explicitly label it as optional.



## Page 2

- Do not recommend broad cleanup unless it directly supports the approved task.
- Prefer small, reviewable phases over sweeping edits.
- Separate planning from execution in every response.
Always output your response using this exact structure:
## Plan Summary
## Assumptions
## Files to Update
## Files to Inspect Only
## Change Steps
## Codex Prompt
## Local Validation Steps
## Expected Results
## Commit Suggestion
## Next Phase
Before generating the plan, use this project operating context:
Project Name: [project name]
Repository Name: [repo name]
Primary Stack: [stack]
Branch: [branch]
Automation Level: [Level 1 / 2 / 3 / 4]
Approval Gates:
- Planning approval required before edits: yes
- Human review required before commit: yes
- Human review required before push: yes
Task Type: [feature / bugfix / refactor / docs / setup]
Task Title: [short title]
Objective:
[exact requested change]
Why This Change Is Needed:
[problem being solved]
Acceptance Criteria:
- [criteria]
- [criteria]
- [criteria]
Constraints:
- [constraint]
- [constraint]
- [constraint]
Non-Goals:
- [not in scope]
- [not in scope]
Known Relevant Files:



## Page 3

- [file path]
- [file path]
- [file path]
Relevant Architecture Notes:
[brief architecture notes]
Validation Commands:
- [command]
- [command]
- [command]
Commit Style:
[preferred style]
Now wait for the task details packet or, if the task details are already present, proceed with the plan.
3. Repository Folder Template
Recommended structure to commit into each repo. Keep it simple, versionable, and boring in the 
best possible way.
<repo-root>/
 .vscode/├──
    settings.json│ ├──
    extensions.json│ ├──
    <project>.code-workspace   (optional if you prefer workspace files)│ └──
 docs/├──
    ai-devops/│ └──
        approval-gated-devops-playbook.docx│ ├──
        project-starter-packet-kit.docx│ ├──
        ai-project-bootstrap-kit.docx│ ├──
        prompts/│ ├──
           bootstrap-prompt.md│ │ ├──
           codex-execution-prompt.md│ │ ├──
           validation-reply-template.md│ │ ├──
           recovery-prompt.md│ │ └──
        task-packets/│ ├──
           2026-03-16-feature-cart-qty.md│ │ ├──
           2026-03-18-bugfix-price-rounding.md│ │ └──
        session-notes/│ └──
            2026-03-16-planning-summary.md│ ├──
            2026-03-16-validation-results.md│ └──
 src/ or app/ or server/        (project code)├──
 README.md└──
Why this layout works:
 prompts/ keeps your reusable copy-paste material in one stable place.
 task-packets/ gives each change phase a durable paper trail.



## Page 4

 session-notes/ captures what happened after the AI made changes, which is gold when 
debugging or onboarding later.
 .vscode/ stores the workspace defaults that reduce friction for repeat Codex sessions.
4. VS Code Workspace Configuration for Codex Sessions
These settings are intentionally conservative. The goal is a workflow that works repeatedly, not a 
gadget demo.
Recommended workspace habits
 Open only the active repository root for the current task.
 Pull the latest branch state before starting a planning cycle.
 Close unrelated folders or multi-root workspaces unless they are required for the task.
 Pin the planning chat, Codex panel, terminal, and source control views so the operating loop 
is visible.
 Treat source control and terminal output as the truth serum for whether the AI actually 
helped.
Suggested .vscode/settings.json baseline
{
  "files.autoSave": "afterDelay",
  "files.autoSaveDelay": 1500,
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll": "explicit",
    "source.organizeImports": "explicit"
  },
  "git.enableSmartCommit": false,
  "git.confirmSync": true,
  "explorer.confirmDragAndDrop": true,
  "explorer.confirmDelete": true,
  "files.exclude": {
    "**/.DS_Store": true
  }
}
Notes:
 Auto-save is convenient, but the playbook should never depend on it as the only safeguard.
 Smart commit stays off so commits remain a deliberate approval gate.
 Format-on-save is useful only if the project already has agreed formatting rules. If not, disable 
it per repo.
Suggested .vscode/extensions.json baseline
{
  "recommendations": [
    "github.copilot-chat",
    "dbaeumer.vscode-eslint",



## Page 5

    "rust-lang.rust-analyzer",
    "tamasfe.even-better-toml"
  ]
}
Swap the recommendations to match the repo language stack. The important part is consistency, 
not a shrine to extensions.
5. Operating Modes
Keep the default mode human-gated. Raise automation only when the repo and task are stable 
enough to deserve it.
Mode What Codex May Do Recommended Use
Default approval-gated
Edit approved files; save if 
supported; summarize 
changes
Most feature work, bug fixes, 
and anything touching 
business logic
Validation-assisted Edit approved files and run 
approved local checks
Stable repos with reliable 
build/test commands
Commit-assisted
Edit, save, validate, and 
prepare or create a local 
commit after approval
Only after the normal loop has 
proven itself in that repo
6. Quick Start Checklist
 Connect the repo to ChatGPT through the GitHub connector.
 Open the local repo in VS Code with the Codex extension signed in.
 Store these workflow documents inside docs/ai-devops/.
 Paste the Bootstrap Prompt into a new planning chat.
 Provide the task packet and review the returned file list before editing.
 Paste the generated Codex Prompt into Codex and let it update the approved files.
 Run validation commands, review the diff, then commit only after the phase passes.
7. Recommended Companion Files
 bootstrap-prompt.md — copy of the universal planning prompt
 codex-execution-prompt.md — reusable execution shell for Codex
 validation-reply-template.md — standard handoff back into the planning chat
 recovery-prompt.md — emergency brakes when scope drifts
 repo-workflow-readme.md — repo-specific notes that override the generic playbook

