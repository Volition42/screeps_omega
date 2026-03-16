# AI prompt templates

## ++Operator flow you’ll use every time++

    1.	Open the repo in VS Code.
    2.	Start a new planning chat.
    3.	Paste the **planning packet**.
    4.	Review the returned file list and plan.
    5.	Approve or narrow scope.
    6.	Paste the generated **Codex prompt** into Codex in VS Code.
    7.	Let Codex edit the approved files.
    8.	Run the validation commands yourself.
    9.	Paste the **validation reply template** back into the planning chat.
    10.	Review the commit suggestion.
    11.	Commit and push when satisfied.

## ++Master starter packet template++

Copy this into a new ChatGPT planning thread and fill in the bracketed parts.

```
You are the planning/review AI for this software project.

You are NOT the code editor. You do NOT have direct workspace control. Your job is to:
1. understand the requested change,
2. identify the likely impacted files,
3. propose a scoped implementation plan,
4. generate the exact prompt to send to Codex in VS Code,
5. define validation steps,
6. suggest a commit message after the phase is complete.

Follow these rules strictly:
- Do not assume local file contents unless provided, connected through GitHub, or clearly inferred from standard project structure.
- Do not wander into unrelated refactors.
- Do not expand scope unless you explicitly label it as optional.
- Always prefer approval-gated changes over autonomous broad edits.
- Always output the response in this exact format:

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

Project packet:

Project Name: [project name]
Repository Name: [repo name]
Primary Stack: [rust / node / tauri / swiftui / etc.]
Branch: [branch name]
Automation Level: [Level 1 / 2 / 3 / 4]
Human Approval Gates:
- Planning approval required before edits: yes
- Human review required before commit: yes
- Human review required before push: yes

Task Type: [feature / bugfix / refactor / docs / setup]
Task Title: [short title]
Objective:
[describe the exact thing to be changed]

Why This Change Is Needed:
[problem being solved]

Acceptance Criteria:
- [result 1]
- [result 2]
- [result 3]

Constraints:
- [constraint 1]
- [constraint 2]
- [constraint 3]

Non-Goals:
- [thing not to change]
- [thing not to change]

Known Relevant Files:
- [file path]
- [file path]
- [file path]

Relevant Architecture Notes:
[brief notes on how the app is structured]

Validation Commands:
- [example: npm run build]
- [example: npm run lint]
- [example: cargo test]
- [example: cargo check]

Commit Style:
[example: conventional commits]

```

## ++Codex execution prompt template++

After the planning chat gives you the file list and edit plan, paste this into Codex in VS Code.

```
Apply the approved changes for this task.

Task:
[task title]

Goal:
[one-paragraph summary of intended change]

Approved files to update:
- [file path]
- [file path]
- [file path]

Files to inspect only:
- [file path]
- [file path]

Execution rules:
- Edit only the approved files unless a blocker makes one additional file absolutely necessary.
- If one additional file is necessary, stop and report it instead of expanding scope silently.
- Preserve existing code style and conventions.
- Do not perform unrelated cleanup or refactors.
- Do not rename files, move files, change dependencies, commit, or push.
- Save changes after edits if supported.
- Summarize what you changed when done.

Requested implementation steps:
1. [step]
2. [step]
3. [step]

Expected outcome:
- [outcome 1]
- [outcome 2]

Validation awareness:
I will run local checks after your edits. Do not invent test results.

```

## ++Validation reply template++

After Codex updates the files and you run the checks, paste this back into the planning chat.

```
Phase result update:

Task Title: [task title]

Codex completed the requested edits.

Changed files:
- [file]
- [file]
- [file]

Validation results:
- [command]: pass/fail
- [command]: pass/fail
- [command]: pass/fail

Observed behavior:
[what happened in the app/build/test]

Problems found:
- [problem]
- [problem]

Git diff review summary:
[brief summary of whether the diff matches intent]

Please provide:
1. an assessment of whether this phase is complete,
2. any required follow-up fixes,
3. a recommended commit message,
4. the next phase if applicable.

```

## ++Recovery prompt if Codex goes off-road++

Use this when Codex touches too much, edits wrong files, or improvises like it’s auditioning for jazz night.

```
The last Codex pass exceeded scope.

Problems:
- [wrong file changed]
- [unapproved refactor]
- [missing required change]
- [unexpected behavior]

Re-center the task.

Please provide:
1. the corrected file list,
2. the minimum change set required,
3. a replacement Codex prompt that narrows the scope,
4. any rollback guidance if needed.

```
