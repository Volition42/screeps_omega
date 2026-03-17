# Approval Gated Devops Playbook

_Converted from `approval_gated_devops_playbook.pdf`_


## Page 1

ChatGPT + Codex Approval-Gated DevOps Playbook
Page 1
Approval-Gated DevOps Playbook
ChatGPT Planning + Codex IDE Execution + GitHub Repo Context
Reusable workflow template for VS Code workspaces with GitHub-connected planning and 
Codex-driven code updates.
Document purpose
Provide a repeatable, approval-gated workflow for using ChatGPT 
as planner/reviewer, Codex as workspace editor, and Git as the 
control plane.
Prepared for: Maker
Document type: Master workflow template with filled example
Intended use: Daily development playbook for projects using GitHub, VS Code, ChatGPT, and the 
Codex IDE extension
Reference basis: Official OpenAI Codex IDE and GitHub-connector documentation, checked March 
16, 2026
This playbook favors reliability over theatrics. The robot gets a wrench, not the company credit card.



## Page 2

ChatGPT + Codex Approval-Gated DevOps Playbook
Page 2
1. Executive Overview
This playbook defines a practical development pipeline for projects where ChatGPT is used to 
reason about changes, identify impacted files, and generate execution prompts, while the Codex 
IDE extension in VS Code performs workspace edits against the local repository. Git remains the 
source of truth and the approval gates keep the workflow from drifting into speculative cleanup or 
broad refactors.
The design goal is not to maximize automation for its own sake. The design goal is to make 
shipping code repeatable, reviewable, and boring in the best possible way. Optional automation is 
allowed only where it supports the approval-gated pipeline instead of weakening it.
The workflow is language- and framework-agnostic. It works for Rust, Node, Tauri, SwiftUI, 
Minecraft tooling, and other stacks, provided each task clearly names its acceptance criteria and 
validation commands.
Workflow in one line: plan in ChatGPT → approve scope → execute in Codex → validate locally → 
review diff → commit → repeat.
Primary roles
Role Primary responsibility Allowed actions Approval 
required?
ChatGPT chat Planner and reviewer
Clarify requirements, 
produce scope, list impacted 
files, write Codex prompt, 
suggest validation and 
commit text
Yes, before 
execution
Codex in VS Code Workspace execution agent
Read local files, update 
approved files, optionally 
save and run approved 
commands
Yes, bounded by 
task packet
Maker Gatekeeper and operator
Approve scope, open 
workspace, run checks, 
review diff, commit and push 
unless delegated
Final authority



## Page 3

ChatGPT + Codex Approval-Gated DevOps Playbook
Page 3
2. Core Principles
Approval before execution
No code changes happen until the planner has named the likely file scope and the human has 
approved it.
Small batches beat heroic batches
Work should move in logical phases so failures are easier to isolate and revert.
Context is a tool, not a leash
GitHub-connected ChatGPT provides repo awareness for planning; Codex uses local workspace 
context for implementation.
Validation is mandatory
A phase is not complete because the AI stopped typing. A phase is complete when the defined 
validation steps pass and the diff matches intent.
Automation is optional and bounded
Saving, running checks, staging, and committing can be delegated if the task packet allows it. Push 
remains a conscious gate unless a future workflow version explicitly changes that policy.



## Page 4

ChatGPT + Codex Approval-Gated DevOps Playbook
Page 4
3. One-Time Setup
3.1 Connect GitHub to ChatGPT
1. In ChatGPT, open Settings and navigate to Apps.
2. Locate GitHub in the app directory and start the connection flow.
3. Authorize the ChatGPT GitHub app in GitHub, then choose the repositories or organizations you 
want ChatGPT to access for planning context.
4. After the connection completes, return to ChatGPT and verify that GitHub shows as connected. If 
needed, use the gear icon in Settings  Apps  GitHub to change repository access later.→ →
5. Use the connected repository in planning chats when you want ChatGPT to inspect repo contents, 
README files, docs, and code context before it writes the Codex execution prompt.
What this enables:
GitHub connection gives ChatGPT repo-aware planning context. It does not replace the local VS 
Code workspace and it should not be treated as direct IDE control.
3.2 Install and Configure the Codex IDE Extension
1. Open VS Code and install the official Codex IDE extension from OpenAI.
2. Sign in with the same ChatGPT account you use for planning chats, or use an API key only if that 
is your chosen account model.
3. Open the target repository as a clean VS Code workspace root. Avoid leaving unrelated projects 
open beside it.
4. Open the Codex panel in VS Code and confirm it can read the workspace context.
5. Decide your trust mode for the repository: default to edit-only, then expand to save, run 
validation commands, or commit only after the base workflow proves stable.
6. If you use VS Code Auto Save, treat it as a convenience, not as the primary safety mechanism. 
The playbook assumes you still review diffs and validation output explicitly.
Recommended local baseline
 Git repository cloned locally and reachable over SSH.
 Correct branch checked out before beginning a task.
 Project builds or starts locally without AI intervention first.
 Lint, test, and typecheck commands known in advance for the repository.
4. Standard Operating Modes
The playbook stays approval-gated in every mode. The difference is which actions Codex may 
perform after scope approval.



## Page 5

ChatGPT + Codex Approval-Gated DevOps Playbook
Page 5
Level Name Codex may do Best use case
0 Plan-only
No code edits; ChatGPT only 
produces the work packet and 
execution prompt.
Discovery, 
architecture, tricky 
refactors
1 Edit Read and update approved files 
only.
Normal safe starting 
point
2 Edit + save Update and save approved files.
Low-risk changes 
once trust is 
established
3 Edit + save + validate Update files, save, and run pre-
approved checks.
Routine feature work 
and bug fixes
4 Edit + save + validate + 
commit
Do all of the above and create a local 
commit using the approved message.
Stable repos with 
mature checks
Recommended default: start every new repository at Level 1 and graduate upward only after several 
clean cycles.



## Page 6

ChatGPT + Codex Approval-Gated DevOps Playbook
Page 6
5. Task Packet and Required Response Format
Every work cycle begins with a task packet. This keeps the planner and the executor aligned and 
prevents accidental scope creep.
Task packet field What it contains
Project / repo Repository name and current branch
Objective Specific feature, bug, refactor, or documentation change
Constraints Non-goals, style rules, architecture limits, or files to preserve
Acceptance criteria What must be true when the phase is complete
Automation level Allowed Codex actions for this task
Candidate files Likely impacted files, folders, or modules
Validation commands Commands the human or Codex should run to verify the change
Commit policy Manual commit or Codex-generated local commit
Required planner response format
 Plan Summary
 Files to Update
 Files to Inspect Only
 Codex Prompt
 Local Validation Steps
 Expected Results
 Commit Suggestion
 Next Phase
The planner should not skip directly to code. It should first translate the request into scope, affected 
files, and a bounded execution prompt.
6. Standard Development Cycle
Phase 0 — Intake
Describe the change, constraints, and desired outcome. Include branch name and validation 
commands whenever possible.



## Page 7

ChatGPT + Codex Approval-Gated DevOps Playbook
Page 7
Phase 1 — Planning in ChatGPT
ChatGPT analyzes the request, names assumptions, proposes likely files, and writes the Codex 
execution prompt.
Phase 2 — Scope Approval
Maker reviews the file list and approves, narrows, or splits the task. This is the primary anti-
wander gate.
Phase 3 — Codex Execution
The approved prompt is pasted into Codex in the open VS Code workspace. Codex updates only the 
approved scope.
Phase 4 — Validation
Run build, test, lint, typecheck, or app-start checks. Compare actual output to the acceptance 
criteria.
Phase 5 — Diff Review
Review git diff and changed files. Confirm that the edits match the approved intent and did not 
drift into cleanup work.
Phase 6 — Commit Gate
Create the commit manually or allow Codex to create the local commit if the automation level 
permits it.
Phase 7 — Repeat or Close
Return results to ChatGPT, then begin the next packet or close the feature branch.



## Page 8

ChatGPT + Codex Approval-Gated DevOps Playbook
Page 8
7. Copy/Paste Starter Prompts
7.1 New ChatGPT Planning Thread
You are the planning and review agent for this repository. Do not assume local workspace access. Your job is to 
translate each request into an approval-gated task packet. For every task, respond using exactly these sections: 
Plan Summary, Files to Update, Files to Inspect Only, Codex Prompt, Local Validation Steps, Expected Results, 
Commit Suggestion, Next Phase.
Rules:
- Do not tell Codex to roam the repository.
- Keep edits scoped to the minimum practical file list.
- Do not invent cleanup work outside the requested change.
- If the scope is broad, split the work into phases.
- Assume Maker is the approval gate before any execution.
- Prefer explicit file names and commands over vague advice.
- When useful, ask for one missing fact; otherwise make a reasonable bounded plan and state assumptions.
7.2 New Codex Session Prompt
You are the execution agent for the open VS Code workspace. Work only on the files listed in the task packet. 
Follow the requested automation level exactly. Do not perform unrelated cleanup, dependency upgrades, file 
moves, or broad refactors unless explicitly instructed. If a blocker appears, report it instead of guessing.
Execution rules:
- Update only approved files.
- Preserve existing project style and structure.
- Save changes only if allowed in the task packet.
- Run only the validation commands listed in the task packet.
- Commit only if commit permission is explicitly granted.
- Never push unless explicitly authorized by Maker.
7.3 Human Validation Reply Template
Validation results:
- Branch:
- Commands run:
- Pass / fail:
- Relevant output:
- Files actually changed:
- Diff review summary:
- Ready for commit? yes / no
Use this reply to ask ChatGPT for the next phase, a recovery plan, or a commit message update.



## Page 9

ChatGPT + Codex Approval-Gated DevOps Playbook
Page 9
8. Filled Example — Rust + Node + Tauri Sales/Cart Project
Example objective
Add quantity controls to the cart, persist cart state locally, update subtotal/tax/total display, and 
show a low-stock warning badge when an item is near depletion.
Example task packet
Field Example value
Project / repo makersmania-shop on branch feature/cart-quantity-controls
Objective Add cart quantity increment/decrement controls and totals 
recalculation
Constraints Do not redesign the cart page. Keep current state management 
pattern. No dependency changes.
Acceptance criteria Users can change quantity from the cart; totals update immediately; 
cart survives reload; low-stock badge appears under threshold.
Automation level Level 3 — edit, save, validate
Candidate files src/web/cart/CartPage.tsx; src/web/cart/cartStore.ts; 
src/web/components/CartItemRow.tsx; src/api/pricing.ts; 
src-tauri/src/cart_state.rs
Validation commands npm run lint; npm run test; npm run build; cargo test
Commit policy Manual commit after diff review
Example planner output (abbreviated)
Plan Summary
Implement cart quantity controls in the UI and central store, wire recalculation into pricing, persist 
cart state through the existing store adapter, and surface low-stock warnings without changing 
page layout.
Files to Update
src/web/cart/CartPage.tsx; src/web/components/CartItemRow.tsx; src/web/cart/cartStore.ts; 
src/api/pricing.ts; src-tauri/src/cart_state.rs
Files to Inspect Only
src/web/types/cart.ts; src/web/hooks/useCart.ts; src/api/inventory.ts



## Page 10

ChatGPT + Codex Approval-Gated DevOps Playbook
Page 10
Local Validation Steps
Run npm run lint, npm run test, npm run build, and cargo test. Verify quantity controls work in the 
app and that cart contents survive reload.
Commit Suggestion
feat(cart): add quantity controls and persistent totals
Next Phase
Add stock-reservation handling only after this UI/state phase passes cleanly.
Example Codex prompt to paste into VS Code
Task: implement the approved cart quantity feature in the open workspace.
Update these files:
- src/web/cart/CartPage.tsx
- src/web/components/CartItemRow.tsx
- src/web/cart/cartStore.ts
- src/api/pricing.ts
- src-tauri/src/cart_state.rs
Inspect only if needed:
- src/web/types/cart.ts
- src/web/hooks/useCart.ts
- src/api/inventory.ts
Constraints:
- Keep the current cart layout.
- Do not add dependencies.
- Do not refactor unrelated code.
- Use the existing state management pattern.
- Save the updated files.
- After editing, run: npm run lint && npm run test && npm run build && cargo test
- Do not commit.
Expected result:
- Quantity increment/decrement controls work in the cart.
- Totals recalculate immediately.
- Cart state persists on reload.
- Low-stock warning badge appears for near-depleted items.
If you hit a blocker, stop and summarize the blocker and affected files.



## Page 11

ChatGPT + Codex Approval-Gated DevOps Playbook
Page 11
9. Failure Modes and Recovery Rules
Codex changed too many files
Discard the run or revert the extra files, then reissue the task with a narrower packet and a shorter 
file list.
Validation failed
Paste the error output back into ChatGPT and ask for a recovery packet that targets only the failing 
area.
Diff includes unrelated cleanup
Do not commit. Re-scope the change and ask for a corrected Codex prompt.
Workspace drifted from GitHub
Pull or rebase before continuing. Planning against stale repo context is how you summon 
avoidable pain.
Partial success
Commit only when the acceptance criteria for that phase are met. Otherwise keep the work as an 
uncommitted checkpoint or a separate WIP branch.
10. Per-Phase Review Checklist
 Correct branch checked out
 Task packet complete
 Planner named the file scope
 Human approved the scope
 Codex changed only intended files
 Validation commands ran
 Diff matches requested behavior
 Commit message matches the phase
11. Recommended Commit and Branch Strategy
Use one logical change per commit. Prefer small feature or bugfix branches with names that 
describe intent, such as feature/cart-quantity-controls or fix/tax-rounding. Push only after the local 
validation and diff review pass. If Codex is allowed to commit, keep push as a human gate unless 
the repository has exceptionally strong protections and the workflow is deliberately upgraded 
later.
12. Quick Reference
 Plan in ChatGPT, execute in Codex, verify in Git.
 Start new repos at automation Level 1.
 Keep scope approval as the primary control point.



## Page 12

ChatGPT + Codex Approval-Gated DevOps Playbook
Page 12
 Use explicit acceptance criteria and validation commands.
 Treat optional automation as a privilege earned by clean runs, not as the default setting.
13. Official Sources
The setup portions of this playbook were checked against official OpenAI documentation on March 
16, 2026.
Codex IDE extension: https://developers.openai.com/codex/ide/
Codex Quickstart: https://developers.openai.com/codex/quickstart/
Using Codex with your ChatGPT plan: https://help.openai.com/en/articles/11369540-using-codex-with-your-
chatgpt-plan
Connecting GitHub to ChatGPT: https://help.openai.com/en/articles/11145903-connecting-github-to-chatgpt

