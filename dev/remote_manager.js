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

module.exports = {
  getHomeRoomSites(homeRoomName) {
    if (!config.REMOTE_MINING || !config.REMOTE_MINING.ENABLED) return [];

    const sites = config.REMOTE_MINING.SITES || {};
    const results = [];

    for (const targetRoom in sites) {
      if (!Object.prototype.hasOwnProperty.call(sites, targetRoom)) continue;

      const site = sites[targetRoom];
      if (!site || !site.enabled) continue;
      if (site.homeRoom !== homeRoomName) continue;

      results.push(this.normalizeSite(targetRoom, site));
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
