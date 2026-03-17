/*
Developer Summary:
Remote Manager

Purpose:
- Normalize remote mining site configuration in one place
- Make remote phase progression explicit without enabling the full roadmap yet
- Provide Phase 2 readiness hooks for future remote miners / haulers / roads

Remote progression model:
- Phase 1: remote jrworker
- Phase 2: remote miner / remote hauler / remote container / roads
- Phase 3: reservation
- Phase 4: auto scoring

Important Notes:
- This pass keeps live behavior narrow and mostly preserves current spawning
- Reservation config is preserved even if a site has not advanced to Phase 3 yet
- Home room state can reuse these normalized site descriptors without rescanning
*/

const config = require("config");
const utils = require("utils");

var scanCacheTick = null;
var visibleScanCache = {};
var usernameCache = {
  tick: 0,
  username: null,
};

function resetScanCacheIfNeeded() {
  if (scanCacheTick === Game.time) return;

  scanCacheTick = Game.time;
  visibleScanCache = {};
}

function groupObjectsByType(objects) {
  var grouped = {};

  for (var i = 0; i < objects.length; i++) {
    var object = objects[i];
    var type = object.structureType;

    if (!type) continue;
    if (!grouped[type]) grouped[type] = [];
    grouped[type].push(object);
  }

  return grouped;
}

function toPosKey(pos) {
  return pos.x + ":" + pos.y;
}

function serializePos(pos) {
  if (!pos) return null;

  return {
    x: pos.x,
    y: pos.y,
    roomName: pos.roomName,
  };
}

function deserializePos(pos) {
  if (!pos) return null;

  return new RoomPosition(pos.x, pos.y, pos.roomName);
}

module.exports = {
  getHomeRoomSites(homeRoomName, state) {
    if (!config.REMOTE_MINING || !config.REMOTE_MINING.ENABLED) return [];

    const sites = config.REMOTE_MINING.SITES || {};
    const results = [];

    for (const targetRoom in sites) {
      if (!Object.prototype.hasOwnProperty.call(sites, targetRoom)) continue;

      const site = sites[targetRoom];
      if (!site || !site.enabled) continue;
      if (site.homeRoom !== homeRoomName) continue;

      results.push(this.enrichSite(this.normalizeSite(targetRoom, site), state));
    }

    results.sort(function (a, b) {
      if (a.phase !== b.phase) return a.phase - b.phase;
      return a.targetRoom.localeCompare(b.targetRoom);
    });

    return results;
  },

  getHomeRoomPlan(room, state, remoteSites) {
    const sites = remoteSites || [];
    const controllerLevel = room.controller ? room.controller.level : 0;
    const recommendedSiteCap = controllerLevel >= 4 ? 3 : 2;
    const activeSites = _.filter(sites, function (site) {
      return site.enabled;
    }).length;

    return {
      recommendedSiteCap: recommendedSiteCap,
      activeSites: activeSites,
      overCap: activeSites > recommendedSiteCap,
      phaseTwoReadySites: _.filter(sites, function (site) {
        return site.phaseHooks.phaseTwoReady;
      }).length,
      visibleSites: _.filter(sites, function (site) {
        return site.visible;
      }).length,
      phaseTwoOperationalSites: _.filter(sites, function (site) {
        return site.phase >= 2 && site.progress && site.progress.sourceContainersBuilt > 0;
      }).length,
      phaseThreeSites: _.filter(sites, function (site) {
        return site.phaseHooks.phaseThreeReady;
      }).length,
      phaseFourSites: _.filter(sites, function (site) {
        return site.phaseHooks.phaseFourReady;
      }).length,
      phases: _.map(sites, function (site) {
        return site.phaseLabel;
      }),
    };
  },

  normalizeSite(targetRoom, site) {
    const phase = Math.max(1, Math.min(4, site.phase || 1));
    const sourceDefaults = site.sourceDefaults || {};
    const reservation = site.reservation || {};

    return {
      targetRoom: targetRoom,
      enabled: site.enabled !== false,
      homeRoom: site.homeRoom,
      phase: phase,
      phaseLabel: this.getPhaseLabel(phase),
      jrWorkers: site.jrWorkers || 0,
      remoteWorkers:
        site.remoteWorkers || config.REMOTE_MINING.phase2WorkersDefault || 1,
      reservation: {
        enabled: reservation.enabled === true,
        reservers: reservation.reservers || 1,
        renewBelow: reservation.renewBelow || 2000,
      },
      sourceDefaults: {
        miners: sourceDefaults.miners || 1,
        haulers: sourceDefaults.haulers || 1,
      },
      sourcesById: site.sourcesById || {},
      phaseHooks: {
        phaseOneReady: phase >= 1,
        phaseTwoReady: phase >= 2,
        phaseThreeReady: phase >= 3,
        phaseFourReady: phase >= 4,
      },
      futureRoles: {
        remoteMiner: phase >= 2,
        remoteHauler: phase >= 2,
        reserver: phase >= 3,
        autoScore: phase >= 4,
      },
      infrastructure: {
        remoteContainer: phase >= 2,
        roads: phase >= 2,
      },
    };
  },

  enrichSite(site, state) {
    var scan = this.getVisibleRoomScan(site.targetRoom);
    var assignedRoleCounts = this.getAssignedRoleCounts(state, site.targetRoom);
    var sourceDetails = this.getSourceDetails(site, state, scan);
    var progress = this.getProgress(site, scan, sourceDetails);
    var reservationStatus = scan
      ? scan.reservationStatus
      : this.getCachedReservationStatus(site.targetRoom);

    if (scan) {
      this.storeSiteIntel(site, sourceDetails, reservationStatus);
    }

    return Object.assign({}, site, {
      visible: !!scan,
      remoteRoom: scan ? scan.room : null,
      remoteState: scan
        ? {
            room: scan.room,
            sources: scan.sources,
            sites: scan.sites,
            sitesByType: scan.sitesByType,
            structures: scan.structures,
            structuresByType: scan.structuresByType,
            sourceContainersBySourceId: scan.sourceContainersBySourceId,
            sourceContainerSitesBySourceId: scan.sourceContainerSitesBySourceId,
          }
        : null,
      sourceDetails: sourceDetails,
      progress: progress,
      assignedRoleCounts: assignedRoleCounts,
      reservationStatus: reservationStatus,
      phaseTargets: {
        remoteWorkers:
          site.phase >= 2 &&
          (!scan ||
            progress.activeConstructionSites > 0 ||
            progress.damagedInfrastructure > 0 ||
            progress.sourceContainersBuilt + progress.sourceContainersPlanned <
              progress.sourceCount ||
            progress.roadsBuilt + progress.roadsPlanned < progress.roadsTarget)
            ? site.remoteWorkers
            : 0,
      },
      statusLabel: this.getStatusLabel(site, progress, assignedRoleCounts),
    });
  },

  getVisibleRoomScan(targetRoom) {
    resetScanCacheIfNeeded();

    if (Object.prototype.hasOwnProperty.call(visibleScanCache, targetRoom)) {
      return visibleScanCache[targetRoom];
    }

    var room = Game.rooms[targetRoom];
    if (!room) {
      visibleScanCache[targetRoom] = null;
      return null;
    }

    var sources = room.find(FIND_SOURCES);
    var structures = room.find(FIND_STRUCTURES);
    var sites = room.find(FIND_CONSTRUCTION_SITES);
    var hostiles = room.find(FIND_HOSTILE_CREEPS);
    var structuresByType = groupObjectsByType(structures);
    var sitesByType = groupObjectsByType(sites);
    var sourceContainers = _.filter(
      structuresByType[STRUCTURE_CONTAINER] || [],
      function (structure) {
        return _.some(sources, function (source) {
          return structure.pos.getRangeTo(source) <= 1;
        });
      },
    );
    var sourceContainerSites = _.filter(
      sitesByType[STRUCTURE_CONTAINER] || [],
      function (constructionSite) {
        return _.some(sources, function (source) {
          return constructionSite.pos.getRangeTo(source) <= 1;
        });
      },
    );
    var sourceContainersBySourceId = {};
    var sourceContainerSitesBySourceId = {};

    for (var i = 0; i < sources.length; i++) {
      var source = sources[i];

      sourceContainersBySourceId[source.id] =
        _.find(sourceContainers, function (container) {
          return container.pos.getRangeTo(source) <= 1;
        }) || null;

      sourceContainerSitesBySourceId[source.id] =
        _.find(sourceContainerSites, function (constructionSite) {
          return constructionSite.pos.getRangeTo(source) <= 1;
        }) || null;
    }

    visibleScanCache[targetRoom] = {
      room: room,
      sources: sources,
      structures: structures,
      structuresByType: structuresByType,
      sites: sites,
      sitesByType: sitesByType,
      hostiles: hostiles,
      sourceContainersBySourceId: sourceContainersBySourceId,
      sourceContainerSitesBySourceId: sourceContainerSitesBySourceId,
      roadKeys: this.toPositionKeyMap(structuresByType[STRUCTURE_ROAD] || []),
      roadSiteKeys: this.toPositionKeyMap(sitesByType[STRUCTURE_ROAD] || []),
      damagedInfrastructure: _.filter(structures, function (structure) {
        if (structure.structureType === STRUCTURE_CONTAINER) {
          return (
            structure.hits <
            structure.hitsMax * config.REPAIR.importantThreshold
          );
        }

        return (
          structure.structureType === STRUCTURE_ROAD &&
          structure.hits < structure.hitsMax * config.REPAIR.roadThreshold
        );
      }),
      reservationStatus: this.getReservationStatus(room),
    };

    return visibleScanCache[targetRoom];
  },

  toPositionKeyMap(objects) {
    var keyMap = {};

    for (var i = 0; i < objects.length; i++) {
      keyMap[toPosKey(objects[i].pos)] = true;
    }

    return keyMap;
  },

  getSourceDetails(site, state, scan) {
    var sourceIds = this.getSourceIds(site, scan);
    var cachedSourceIntel = this.getCachedSourceIntel(site.targetRoom);
    var details = [];

    for (var i = 0; i < sourceIds.length; i++) {
      var sourceId = sourceIds[i];
      var cachedDetail = cachedSourceIntel[sourceId] || {};
      var source = scan
        ? _.find(scan.sources, function (remoteSource) {
            return remoteSource.id === sourceId;
          })
        : null;
      var builtContainer = scan ? scan.sourceContainersBySourceId[sourceId] : null;
      var plannedContainer = scan
        ? scan.sourceContainerSitesBySourceId[sourceId]
        : null;
      var containerPos = null;

      if (builtContainer) {
        containerPos = builtContainer.pos;
      } else if (plannedContainer) {
        containerPos = plannedContainer.pos;
      } else if (scan && source) {
        containerPos = utils.getRemoteSourceContainerPosition(
          scan.room,
          source,
          site.homeRoom,
        );
      } else {
        containerPos = deserializePos(cachedDetail.containerPos);
      }

      var roadPositions =
        scan && containerPos
          ? utils.getRemoteRoadPlanPositions(scan.room, containerPos, site.homeRoom)
          : [];
      var desiredConfig = site.sourcesById[sourceId] || site.sourceDefaults || {};
      var containerBuilt = !!builtContainer || !!cachedDetail.containerBuilt;
      var containerPlanned = !!plannedContainer || !!cachedDetail.containerPlanned;
      var roadTarget = roadPositions.length || cachedDetail.roadTarget || 0;
      var roadBuilt = scan
        ? this.countRoadPositions(roadPositions, scan ? scan.roadKeys : {})
        : cachedDetail.roadBuilt || 0;
      var roadPlanned = scan
        ? this.countRoadPositions(roadPositions, scan ? scan.roadSiteKeys : {})
        : cachedDetail.roadPlanned || 0;

      details.push({
        sourceId: sourceId,
        visible: !!source,
        containerBuilt: containerBuilt,
        containerPlanned: containerPlanned,
        containerPos: containerPos,
        roadPositions: roadPositions,
        roadTarget: roadTarget,
        roadBuilt: roadBuilt,
        roadPlanned: roadPlanned,
        assignedRemoteMiners: this.getRoleSourceCount(
          state,
          "remoteminer",
          sourceId,
        ),
        assignedRemoteHaulers: this.getRoleSourceCount(
          state,
          "remotehauler",
          sourceId,
        ),
        desiredRemoteHaulers:
          desiredConfig.haulers ||
          cachedDetail.desiredRemoteHaulers ||
          site.sourceDefaults.haulers ||
          1,
      });
    }

    return details;
  },

  getSourceIds(site, scan) {
    if (scan && scan.sources && scan.sources.length > 0) {
      return _.map(scan.sources, function (source) {
        return source.id;
      });
    }

    var cachedSourceIds = this.getCachedSourceIds(site.targetRoom);
    if (cachedSourceIds.length > 0) {
      return cachedSourceIds;
    }

    return Object.keys(site.sourcesById || {});
  },

  countRoadPositions(positions, keyMap) {
    var total = 0;

    for (var i = 0; i < positions.length; i++) {
      if (keyMap[toPosKey(positions[i])]) total++;
    }

    return total;
  },

  getProgress(site, scan, sourceDetails) {
    var roadTargetKeys = {};

    for (var i = 0; i < sourceDetails.length; i++) {
      var detail = sourceDetails[i];

      for (var j = 0; j < detail.roadPositions.length; j++) {
        roadTargetKeys[toPosKey(detail.roadPositions[j])] = true;
      }
    }

    var roadsTarget = Object.keys(roadTargetKeys).length;
    var roadsBuilt = 0;
    var roadsPlanned = 0;
    var roadKeys = scan ? scan.roadKeys : {};
    var roadSiteKeys = scan ? scan.roadSiteKeys : {};

    for (var key in roadTargetKeys) {
      if (!Object.prototype.hasOwnProperty.call(roadTargetKeys, key)) continue;
      if (roadKeys[key]) roadsBuilt++;
      if (roadSiteKeys[key]) roadsPlanned++;
    }

    return {
      sourceCount: sourceDetails.length,
      visibleSourceCount: _.filter(sourceDetails, function (detail) {
        return detail.visible;
      }).length,
      sourceContainersBuilt: _.filter(sourceDetails, function (detail) {
        return detail.containerBuilt;
      }).length,
      sourceContainersPlanned: _.filter(sourceDetails, function (detail) {
        return detail.containerPlanned;
      }).length,
      roadsTarget: roadsTarget,
      roadsBuilt: roadsBuilt,
      roadsPlanned: roadsPlanned,
      activeConstructionSites: scan ? scan.sites.length : 0,
      damagedInfrastructure: scan ? scan.damagedInfrastructure.length : 0,
      hostiles: scan ? scan.hostiles.length : 0,
    };
  },

  getAssignedRoleCounts(state, targetRoom) {
    return {
      remotejrworker: this.getRoleTargetRoomCount(state, "remotejrworker", targetRoom),
      remoteworker: this.getRoleTargetRoomCount(state, "remoteworker", targetRoom),
      remoteminer: this.getRoleTargetRoomCount(state, "remoteminer", targetRoom),
      remotehauler: this.getRoleTargetRoomCount(state, "remotehauler", targetRoom),
      reserver: this.getRoleTargetRoomCount(state, "reserver", targetRoom),
    };
  },

  getRoleTargetRoomCount(state, role, targetRoom) {
    if (
      !state ||
      !state.targetRoomRoleMap ||
      !state.targetRoomRoleMap[role] ||
      !state.targetRoomRoleMap[role][targetRoom]
    ) {
      return 0;
    }

    return state.targetRoomRoleMap[role][targetRoom].length;
  },

  getRoleSourceCount(state, role, sourceId) {
    if (
      !state ||
      !state.sourceRoleMap ||
      !state.sourceRoleMap[role] ||
      !state.sourceRoleMap[role][sourceId]
    ) {
      return 0;
    }

    return state.sourceRoleMap[role][sourceId].length;
  },

  getReservationStatus(room) {
    if (!room || !room.controller) {
      return {
        status: "unknown",
        ticksToEnd: 0,
        username: null,
        label: "UNKNOWN",
      };
    }

    var reservation = room.controller.reservation;

    if (!reservation) {
      return {
        status: "none",
        ticksToEnd: 0,
        username: null,
        label: "NONE",
      };
    }

    var myUsername = this.getMyUsername();
    var mine = myUsername && reservation.username === myUsername;

    return {
      status: mine ? "mine" : "other",
      ticksToEnd: reservation.ticksToEnd || 0,
      username: reservation.username,
      label: mine ? "MINE" : reservation.username,
    };
  },

  getSiteMemory(targetRoom) {
    if (!Memory.rooms) Memory.rooms = {};
    if (!Memory.rooms[targetRoom]) Memory.rooms[targetRoom] = {};
    if (!Memory.rooms[targetRoom].remoteIntel) {
      Memory.rooms[targetRoom].remoteIntel = {
        lastSeen: 0,
        sourceIds: [],
        sourcesById: {},
        reservationStatus: {
          status: "unknown",
          ticksToEnd: 0,
          username: null,
          label: "UNKNOWN",
        },
      };
    }

    return Memory.rooms[targetRoom].remoteIntel;
  },

  storeSiteIntel(site, sourceDetails, reservationStatus) {
    var siteMemory = this.getSiteMemory(site.targetRoom);
    var sourceIds = [];
    var sourcesById = {};

    for (var i = 0; i < sourceDetails.length; i++) {
      var detail = sourceDetails[i];

      sourceIds.push(detail.sourceId);
      sourcesById[detail.sourceId] = {
        containerBuilt: detail.containerBuilt,
        containerPlanned: detail.containerPlanned,
        containerPos: serializePos(detail.containerPos),
        roadTarget: detail.roadTarget,
        roadBuilt: detail.roadBuilt,
        roadPlanned: detail.roadPlanned,
        desiredRemoteHaulers: detail.desiredRemoteHaulers,
      };
    }

    siteMemory.lastSeen = Game.time;
    siteMemory.homeRoom = site.homeRoom;
    siteMemory.sourceIds = sourceIds;
    siteMemory.sourcesById = sourcesById;
    siteMemory.reservationStatus = reservationStatus;
  },

  getCachedSourceIds(targetRoom) {
    var siteMemory = this.getSiteMemory(targetRoom);
    return siteMemory.sourceIds || [];
  },

  getCachedSourceIntel(targetRoom) {
    var siteMemory = this.getSiteMemory(targetRoom);
    return siteMemory.sourcesById || {};
  },

  getCachedReservationStatus(targetRoom) {
    var siteMemory = this.getSiteMemory(targetRoom);

    return (
      siteMemory.reservationStatus || {
        status: "unknown",
        ticksToEnd: 0,
        username: null,
        label: "UNKNOWN",
      }
    );
  },

  getMyUsername() {
    if (usernameCache.tick === Game.time) {
      return usernameCache.username;
    }

    for (var roomName in Game.rooms) {
      if (!Object.prototype.hasOwnProperty.call(Game.rooms, roomName)) continue;
      var room = Game.rooms[roomName];

      if (
        room.controller &&
        room.controller.my &&
        room.controller.owner &&
        room.controller.owner.username
      ) {
        usernameCache.tick = Game.time;
        usernameCache.username = room.controller.owner.username;
        return usernameCache.username;
      }
    }

    usernameCache.tick = Game.time;
    usernameCache.username = null;
    return null;
  },

  getStatusLabel(site, progress, assignedRoleCounts) {
    if (site.phase === 1) {
      return assignedRoleCounts.remotejrworker > 0 ? "BOOTSTRAP" : "IDLE";
    }

    if (progress.hostiles > 0) return "HOSTILES";
    if (progress.sourceContainersBuilt + progress.sourceContainersPlanned < progress.sourceCount) {
      return "CONTAINERS";
    }
    if (progress.roadsBuilt + progress.roadsPlanned < progress.roadsTarget) {
      return "ROADS";
    }
    if (assignedRoleCounts.remoteminer > 0 || assignedRoleCounts.remotehauler > 0) {
      return "ONLINE";
    }

    return "SETUP";
  },

  getPhaseLabel(phase) {
    switch (phase) {
      case 1:
        return "phase1_jrworker";
      case 2:
        return "phase2_infra";
      case 3:
        return "phase3_reservation";
      case 4:
        return "phase4_autoscore";
      default:
        return "phase1_jrworker";
    }
  },
};
