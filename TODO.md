Phase 1
Add construction_roadmap.js and make phase intent explicit.

Phase 2
Add stamp_library.js with:
• anchor_v1
• extension_plus_v1
• tower_cluster_v1
• controller_support_v1

The wiki’s extension examples mention tileable plus-shaped fields, hallway styles, and rapid-fill clusters, and also notes that roads often surround or weave through them to support haulers with efficient carry-to-move ratios. That fits what you want very well. ￼

Phase 3
Add stamp_planner.js:
• choose anchor
• score candidate placements
• validate terrain/open tiles
• prevent overlap
• connect with roads

Phase 4
Make construction_manager.js place structures from the roadmap by stamp priority instead of ad-hoc local searches.

My recommendation for your base style is:
• anchor-centered stamp system
• tileable extension fields
• grid-connected roads
• minimum-cut defense later

That gives you the flexibility of stamps without jumping straight into the hardest part of full dynamic generation.

So the next implementation step should be:
• build construction_roadmap.js
• build stamp_library.js
• update construction_manager.js to place from roadmap + stamps
