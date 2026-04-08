/*
Developer Summary:
Link Manager

Purpose:
- Run the home-room link network once links exist
- Push source-link energy into the room backbone
- Keep the controller link fed without adding expensive scans

Design Notes:
- Logistics phase uses source -> controller flow
- Specialization+ can route source -> storage -> controller
- This module only uses links already discovered in room_state.infrastructure
*/

module.exports = {
  run(room, state) {
    if (!room.controller || room.controller.level < 5) {
      return this.getEmptySummary();
    }

    var infrastructure = state && state.infrastructure ? state.infrastructure : null;
    if (!infrastructure) {
      return this.getEmptySummary();
    }

    var controllerLink = infrastructure.controllerLink || null;
    var storageLink = infrastructure.storageLink || null;
    var terminalLink = infrastructure.terminalLink || null;
    var mineralLink = infrastructure.mineralLink || null;
    var sourceLinks = this.getSourceLinks(infrastructure);
    var summary = {
      transfers: 0,
      sourceToStorage: 0,
      sourceToController: 0,
      storageToController: 0,
      storageToTerminal: 0,
      storageToMineral: 0,
      utilityToStorage: 0,
      utilityToController: 0,
    };

    for (var i = 0; i < sourceLinks.length; i++) {
      var sourceLink = sourceLinks[i];
      var target = this.getSourceLinkTarget(
        sourceLink,
        controllerLink,
        storageLink,
      );
      if (!target) continue;

      if (sourceLink.transferEnergy(target) === OK) {
        summary.transfers += 1;

        if (storageLink && target.id === storageLink.id) {
          summary.sourceToStorage += 1;
        } else if (controllerLink && target.id === controllerLink.id) {
          summary.sourceToController += 1;
        }
      }
    }

    if (
      this.canTransfer(storageLink, controllerLink) &&
      storageLink.transferEnergy(controllerLink) === OK
    ) {
      summary.transfers += 1;
      summary.storageToController += 1;
    }

    if (this.canTransfer(storageLink, terminalLink) && this.shouldFillUtilityLink(terminalLink)) {
      if (storageLink.transferEnergy(terminalLink) === OK) {
        summary.transfers += 1;
        summary.storageToTerminal += 1;
      }
    } else if (this.canTransfer(storageLink, mineralLink) && this.shouldFillUtilityLink(mineralLink)) {
      if (storageLink.transferEnergy(mineralLink) === OK) {
        summary.transfers += 1;
        summary.storageToMineral += 1;
      }
    }

    var utilityLinks = [terminalLink, mineralLink];
    for (var i = 0; i < utilityLinks.length; i++) {
      var utilityLink = utilityLinks[i];
      if (!utilityLink) continue;

      if (
        this.canTransfer(utilityLink, controllerLink) &&
        this.shouldDrainUtilityLink(utilityLink, controllerLink)
      ) {
        if (utilityLink.transferEnergy(controllerLink) === OK) {
          summary.transfers += 1;
          summary.utilityToController += 1;
          continue;
        }
      }

      if (
        this.canTransfer(utilityLink, storageLink) &&
        this.shouldDrainUtilityLink(utilityLink, storageLink)
      ) {
        if (utilityLink.transferEnergy(storageLink) === OK) {
          summary.transfers += 1;
          summary.utilityToStorage += 1;
        }
      }
    }

    return summary;
  },

  getSourceLinks(infrastructure) {
    var bySourceId = infrastructure.sourceLinksBySourceId || {};
    var links = [];

    for (var sourceId in bySourceId) {
      if (!Object.prototype.hasOwnProperty.call(bySourceId, sourceId)) continue;
      if (!bySourceId[sourceId]) continue;

      links.push(bySourceId[sourceId]);
    }

    return links;
  },

  getSourceLinkTarget(sourceLink, controllerLink, storageLink) {
    if (!sourceLink) return null;

    if (this.canTransfer(sourceLink, storageLink)) {
      return storageLink;
    }

    if (this.canTransfer(sourceLink, controllerLink)) {
      return controllerLink;
    }

    return null;
  },

  canTransfer(fromLink, toLink) {
    if (!fromLink || !toLink) return false;
    if (fromLink.id === toLink.id) return false;
    if ((fromLink.store[RESOURCE_ENERGY] || 0) <= 0) return false;
    if (fromLink.cooldown > 0) return false;
    if (toLink.store.getFreeCapacity(RESOURCE_ENERGY) <= 0) return false;

    return true;
  },

  shouldFillUtilityLink(link) {
    if (!link || !link.store) return false;

    return (link.store[RESOURCE_ENERGY] || 0) <= 0;
  },

  shouldDrainUtilityLink(fromLink, toLink) {
    if (!fromLink || !fromLink.store || !toLink || !toLink.store) return false;

    if ((fromLink.store[RESOURCE_ENERGY] || 0) <= 0) return false;

    return toLink.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
  },

  getEmptySummary() {
    return {
      transfers: 0,
      sourceToStorage: 0,
      sourceToController: 0,
      storageToController: 0,
      storageToTerminal: 0,
      storageToMineral: 0,
      utilityToStorage: 0,
      utilityToController: 0,
    };
  },
};
