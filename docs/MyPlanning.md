ToDo:

1. Build the logic needed for RCL:5
2. Build the logic needed for RCL:6
3. Build the logic needed for RCL:7
4. Build the logic needed for RCL:8
5. Automatic expansion layout planner for controlling more rooms
6. Empire manager (multi-room)
7. Start looking into Market stuff

New project packet:

Project Name: Screeps World Domination
Repository Name: screeps_omega
Primary Stack: javascript
Branch: main
Automation Level: 4

Human Approval Gates:

- Planning approval required before edits: no
- Human review required before commit: no
- Human review required before push: yes

Task Type: feature expansion
Task Title: Build the logic needed for RCL:5-6

Objective: Discover what constructuion, utility, creep parts, advancements, etc we get in RCL:5-6 and plan the integration of those into our current logic. Review the former RCL's and validate our code still aligns with our goals and trim extras that are not needed. Keep a close eye on cpu costs and ensure we are not bloating the usage per tick, room management is the largest consumer of cpu per tick.

Constraints:

- Approval-friendly scope only
- No unrelated refactors
- No broad architecture rewrite
- No changes to the remote room hud
- No changes to the creep display hud
- Add concise developer notes where logic materially changes

Relevant Architecture Notes:

- dev/\* is for devdelopment
- release/\* is for syncing changes from dev/ and live testing
- docs/\* is for reference documentation
- docs/ai_project_bootstrap_kid.md is critical source to always remember
- docs/ai_project_bootstrap_prompts.md is critical source to always remember
- docs/approval_fated_devops_playbood.md is critical source to always remember

Commit Style:
git add .
git commit -m "[updated commit message goes here]"
git push
