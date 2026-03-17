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
Task Title: Defense escalation system

Objective: Invaders are coming and we need to be prepared. Devise a plan to update our creeps for defence and attack. These new creeps need to defend home and remote rooms. If an invader is reserving/claiming one of our rooms we should attack it to defend the room. Defence creeps should scale with energy just like other creeps, but appropriatly for this function. I'm not interested in driving new attacks, but reacting to invaders as they come into my rooms.

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
