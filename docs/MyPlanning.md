ToDo:

1. Build the logic needed for RCL:5-6
2. Defense escalation system
4. Automatic expansion layout planner for controlling more rooms
5. Empire manager (multi-room)
6. Start looking into Market stuff




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
Task Title: HUD upgrade

Objective: Devide the home room hud into two panels. The left hand panel will stay the same except the remote room monituring will be removed. The right hand panel looks just like the left panel except it's displaying the remote room monituring. The hud that displays in the remote rooms and the creep displays should not change.

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
- docs/ai_project_bootstrap_kid.pdf is critical source to always remember
- docs/ai_project_bootstrap_prompts.md is critical source to always remember
- docs/approval_fated_devops_playbood.pdf is critical source to always remember

Commit Style:
git add .
git commit -m "[updated commit message goes here]"
git push
