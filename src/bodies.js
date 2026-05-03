/*
Developer Summary:
Role-specific body planner.

Purpose:
- Build creep bodies from room energy capacity and infrastructure state
- Replace the old shared tier ladder with per-role planners
- Expose body metadata so spawn demand can scale with actual throughput
*/

const config = require("config");

const PART_COSTS = {};
PART_COSTS[WORK] = 100;
PART_COSTS[CARRY] = 50;
PART_COSTS[MOVE] = 50;
PART_COSTS[ATTACK] = 80;
PART_COSTS[RANGED_ATTACK] = 150;
PART_COSTS[HEAL] = 250;
PART_COSTS[CLAIM] = 600;
PART_COSTS[TOUGH] = 10;

module.exports = {
  get(role, room, request, state) {
    return this.plan(role, room, request, state).body;
  },

  validateBody(body) {
    if (!Array.isArray(body)) {
      return {
        valid: false,
        reason: "body_not_array",
      };
    }

    if (body.length <= 0) {
      return {
        valid: false,
        reason: "body_empty",
      };
    }

    if (body.length > 50) {
      return {
        valid: false,
        reason: "body_too_large",
        parts: body.length,
      };
    }

    for (let i = 0; i < body.length; i++) {
      if (!Object.prototype.hasOwnProperty.call(PART_COSTS, body[i])) {
        return {
          valid: false,
          reason: "invalid_part",
          index: i,
          part: body[i],
        };
      }
    }

    const cost = this.getBodyCost(body);
    if (cost <= 0) {
      return {
        valid: false,
        reason: "body_zero_cost",
      };
    }

    return {
      valid: true,
      cost: cost,
      parts: body.length,
    };
  },

  getEmergencyPlan(role, room) {
    const energyCapacity = this.getEnergyCapacity(room);
    let body = [WORK, CARRY, MOVE];
    let profile = "emergency_fallback";

    switch (role) {
      case "hauler":
      case "remotehauler":
        body = [CARRY, MOVE];
        break;

      case "defender":
        body = [ATTACK, MOVE];
        break;

      case "dismantler":
        body = [WORK, MOVE];
        break;

      case "assault":
        body = [ATTACK, MOVE];
        break;

      case "combat_healer":
        body = [HEAL, MOVE];
        break;

      case "claimer":
      case "reserver":
      case "controller_attacker":
        body = [CLAIM, MOVE];
        break;

      default:
        body = [WORK, CARRY, MOVE];
        break;
    }

    if (this.getBodyCost(body) > energyCapacity) {
      return null;
    }

    return this.finalizePlan(role, profile, body, {
      emergencyFallback: true,
    });
  },

  plan(role, room, request, state) {
    const energyCapacity = this.getEnergyCapacity(room, request);
    const infrastructure = this.getInfrastructure(room, state);
    const threatLevel =
      request && typeof request.threatLevel === "number"
        ? request.threatLevel
        : 1;

    switch (role) {
      case "jrworker":
        return this.finalizePlan("jrworker", "emergency_bootstrap", [
          WORK,
          CARRY,
          MOVE,
        ]);

      case "worker":
        return this.planWorkerBody(energyCapacity, infrastructure);

      case "miner":
        return this.planMinerBody(energyCapacity, request, room, state);

      case "remoteminer":
        return this.planRemoteMinerBody(energyCapacity);

      case "mineral_miner":
        return this.planMineralMinerBody(energyCapacity, request, room, state);

      case "hauler":
        return this.planHaulerBody(energyCapacity, request, room, state);

      case "remotehauler":
        return this.planRemoteHaulerBody(energyCapacity);

      case "upgrader":
        return this.planUpgraderBody(energyCapacity, infrastructure, room, state);

      case "repair":
        return this.planRepairBody(energyCapacity, infrastructure);

      case "claimer":
        return this.planClaimerBody(energyCapacity);

      case "reserver":
        return this.planReserverBody(energyCapacity);

      case "pioneer":
        return this.planPioneerBody(energyCapacity, infrastructure);

      case "remoteworker":
        return this.planRemoteWorkerBody(energyCapacity, infrastructure);

      case "defender":
        return this.finalizePlan(
          "defender",
          request && request.responseMode === "core_breach"
            ? "core_breach"
            : request && request.responseMode === "tower_support"
            ? "tower_support"
            : "threat_reactive",
          this.getDefenderBody(
            energyCapacity,
            threatLevel,
            request && request.responseMode ? request.responseMode : null,
          ),
        );

      case "dismantler":
        return this.planDismantlerBody(energyCapacity);

      case "assault":
        return this.planAssaultBody(energyCapacity);

      case "combat_healer":
        return this.planCombatHealerBody(energyCapacity);

      case "controller_attacker":
        return this.planControllerAttackerBody(energyCapacity);

      default:
        return this.finalizePlan("fallback", "default", [WORK, CARRY, MOVE]);
    }
  },

  planWorkerBody(energyCapacity, infrastructure) {
    const maxWork = this.getConfiguredLimit("workerMaxWork", 8);
    const hasStorage = infrastructure.hasStorage;
    const economyStage = infrastructure.economyStage;
    const counts = {
      work: Math.min(
        maxWork,
        2 + Math.floor(Math.max(0, energyCapacity - 300) / 200) + (hasStorage ? 1 : 0),
      ),
      carry: 1,
      move: 1,
    };
    const minimums = { work: 2, carry: 1, move: 1 };

    counts.carry = Math.max(1, Math.ceil(counts.work / 2));
    counts.move = Math.max(
      1,
      Math.ceil((counts.work + counts.carry) / (hasStorage ? 3 : 2.5)),
    );

    this.fitEconomicCounts(counts, minimums, energyCapacity, [
      "move",
      "carry",
      "work",
    ]);

    return this.finalizePlan(
      "worker",
      hasStorage ? economyStage : "construction_heavy",
      this.buildEconomicBody(counts),
    );
  },

  planMinerBody(energyCapacity, request, room, state) {
    const maxWork = this.getConfiguredLimit("minerMaxWork", 5);
    const sourceContainer =
      request && request.sourceId
        ? state && state.sourceContainersBySourceId
          ? state.sourceContainersBySourceId[request.sourceId]
          : null
        : null;
    const counts = {
      work: Math.min(
        maxWork,
        2 + Math.floor(Math.max(0, energyCapacity - 300) / 125),
      ),
      carry: sourceContainer ? 1 : 2,
      move: sourceContainer ? 1 : 2,
    };
    const minimums = {
      work: 1,
      carry: sourceContainer ? 1 : 2,
      move: sourceContainer ? 1 : 2,
    };

    if (!sourceContainer) {
      counts.carry = Math.max(2, Math.ceil(counts.work / 2));
      counts.move = Math.max(2, Math.ceil((counts.work + counts.carry) / 2));
    }

    this.fitEconomicCounts(counts, minimums, energyCapacity, [
      "move",
      "carry",
      "work",
    ]);

    return this.finalizePlan(
      "miner",
      sourceContainer ? "source_container" : "mobile_harvest",
      this.buildEconomicBody(counts),
    );
  },

  planRemoteMinerBody(energyCapacity) {
    const maxWork = this.getConfiguredLimit("remoteMinerMaxWork", 5);
    const counts = {
      work: Math.min(
        maxWork,
        2 + Math.floor(Math.max(0, energyCapacity - 300) / 125),
      ),
      carry: 1,
      move: 2,
    };
    const minimums = { work: 2, carry: 1, move: 2 };

    counts.move = Math.max(2, Math.ceil((counts.work + counts.carry) / 2));
    this.fitEconomicCounts(counts, minimums, energyCapacity, [
      "move",
      "carry",
      "work",
    ]);

    return this.finalizePlan(
      "remoteminer",
      "reserved_source_container",
      this.buildEconomicBody(counts),
    );
  },

  planMineralMinerBody(energyCapacity, request, room, state) {
    const maxWork = this.getConfiguredLimit("mineralMinerMaxWork", 5);
    const mineralContainer =
      state && Object.prototype.hasOwnProperty.call(state, "mineralContainer")
        ? state.mineralContainer
        : null;
    const counts = {
      work: Math.min(
        maxWork,
        2 + Math.floor(Math.max(0, energyCapacity - 300) / 125),
      ),
      carry: mineralContainer ? 2 : 3,
      move: mineralContainer ? 2 : 3,
    };
    const minimums = {
      work: 2,
      carry: mineralContainer ? 2 : 3,
      move: mineralContainer ? 2 : 3,
    };

    if (!mineralContainer) {
      counts.carry = Math.max(3, Math.ceil(counts.work / 2));
      counts.move = Math.max(3, Math.ceil((counts.work + counts.carry) / 2));
    }

    this.fitEconomicCounts(counts, minimums, energyCapacity, [
      "move",
      "carry",
      "work",
    ]);

    return this.finalizePlan(
      "mineral_miner",
      mineralContainer ? "extractor_stationary" : "extractor_mobile",
      this.buildEconomicBody(counts),
    );
  },

  planHaulerBody(energyCapacity, request, room, state) {
    const carryDemand = this.getHaulerCarryDemand(room, request, state);
    const maxCarry = this.getConfiguredLimit("haulerMaxCarry", 16);
    const counts = {
      work: 0,
      carry: Math.max(2, Math.min(maxCarry, carryDemand)),
      move: 1,
    };
    const minimums = { work: 0, carry: 2, move: 1 };

    counts.move = Math.max(1, Math.ceil(counts.carry / 2));

    this.fitEconomicCounts(counts, minimums, energyCapacity, ["move", "carry"]);

    return this.finalizePlan(
      "hauler",
      carryDemand > counts.carry ? "route_limited" : "route_matched",
      this.buildHaulerBody(counts),
      {
        carryDemand: carryDemand,
      },
    );
  },

  planRemoteHaulerBody(energyCapacity) {
    const maxCarry = this.getConfiguredLimit("remoteHaulerMaxCarry", 16);
    const targetCarry =
      config.RESERVATION &&
      typeof config.RESERVATION.REMOTE_HAULER_CARRY_PARTS === "number"
        ? config.RESERVATION.REMOTE_HAULER_CARRY_PARTS
        : 8;
    const counts = {
      work: 0,
      carry: Math.max(2, Math.min(maxCarry, targetCarry)),
      move: 1,
    };
    const minimums = { work: 0, carry: 2, move: 1 };

    counts.move = Math.max(1, Math.ceil(counts.carry / 2));
    this.fitEconomicCounts(counts, minimums, energyCapacity, ["move", "carry"]);

    return this.finalizePlan(
      "remotehauler",
      "reserved_room_transport",
      this.buildHaulerBody(counts),
      {
        carryDemand: targetCarry,
      },
    );
  },

  planUpgraderBody(energyCapacity, infrastructure, room, state) {
    const maxWork = this.getConfiguredLimit("upgraderMaxWork", 8);
    const hasStorage = infrastructure.hasStorage;
    const storageEnergy = infrastructure.storageEnergy || 0;
    const controllerLevel =
      room && room.controller ? room.controller.level || 0 : 0;
    const bodyThresholds =
      controllerLevel >= 8
        ? (config.UPGRADING && config.UPGRADING.RCL8_BODY_WORK_CAPS) || []
        : (config.UPGRADING && config.UPGRADING.BODY_WORK_THRESHOLDS) || [];
    const storageWorkCap = hasStorage
      ? Math.min(
          maxWork,
          this.getThresholdWork(bodyThresholds, storageEnergy, maxWork),
        )
      : maxWork;
    const counts = {
      work: Math.min(
        storageWorkCap,
        Math.max(
          2,
          Math.floor(energyCapacity / (hasStorage ? 170 : 200)),
        ),
      ),
      carry: 1,
      move: 1,
    };
    const minimums = { work: 2, carry: hasStorage ? 2 : 1, move: 1 };
    let profile = hasStorage ? "storage_fed" : "self_fed";

    counts.carry = hasStorage
      ? Math.max(2, Math.ceil(counts.work / 3))
      : Math.max(1, Math.ceil(counts.work / 2));
    counts.move = Math.max(
      1,
      Math.ceil((counts.work + counts.carry) / (hasStorage ? 3 : 2)),
    );

    if (
      infrastructure.hasControllerLink &&
      infrastructure.hasStorageLink &&
      room &&
      room.controller &&
      room.controller.level >= 6 &&
      storageEnergy >= this.getControllerLinkReadyStorageEnergy()
    ) {
      profile = "controller_link_ready";
    }

    this.fitEconomicCounts(counts, minimums, energyCapacity, [
      "move",
      "carry",
      "work",
    ]);

    return this.finalizePlan(
      "upgrader",
      profile,
      this.buildEconomicBody(counts),
    );
  },

  planRepairBody(energyCapacity, infrastructure) {
    const maxWork = this.getConfiguredLimit("repairMaxWork", 6);
    const counts = {
      work: Math.min(
        maxWork,
        2 + Math.floor(Math.max(0, energyCapacity - 300) / 200),
      ),
      carry: 1,
      move: 1,
    };
    const minimums = { work: 2, carry: 1, move: 1 };

    counts.carry = Math.max(1, Math.ceil(counts.work / 2));
    counts.move = Math.max(
      1,
      Math.ceil((counts.work + counts.carry) / (infrastructure.hasStorage ? 3 : 2.5)),
    );

    this.fitEconomicCounts(counts, minimums, energyCapacity, [
      "move",
      "carry",
      "work",
    ]);

    return this.finalizePlan(
      "repair",
      infrastructure.hasStorage ? "maintenance_backbone" : "bootstrap_maintenance",
      this.buildEconomicBody(counts),
    );
  },

  planClaimerBody(energyCapacity) {
    if (energyCapacity >= 1300) {
      return this.finalizePlan("claimer", "fast_claim", [
        CLAIM,
        CLAIM,
        MOVE,
        MOVE,
      ]);
    }

    return this.finalizePlan("claimer", "claim", [CLAIM, MOVE]);
  },

  planReserverBody(energyCapacity) {
    if (energyCapacity >= 1300) {
      return this.finalizePlan("reserver", "extended_reserve", [
        CLAIM,
        CLAIM,
        MOVE,
        MOVE,
      ]);
    }

    return this.finalizePlan("reserver", "reserve", [CLAIM, MOVE]);
  },

  planPioneerBody(energyCapacity, infrastructure) {
    const plan = this.planWorkerBody(energyCapacity, infrastructure);

    return this.finalizePlan("pioneer", "expansion_bootstrap", plan.body, {
      carryDemand: plan.carryParts || 1,
    });
  },

  planRemoteWorkerBody(energyCapacity, infrastructure) {
    const plan = this.planWorkerBody(energyCapacity, infrastructure);
    const maxWork = this.getConfiguredLimit("remoteWorkerMaxWork", 6);
    const counts = {
      work: Math.min(maxWork, Math.max(1, plan.workParts || 1)),
      carry: Math.max(1, plan.carryParts || 1),
      move: Math.max(1, plan.moveParts || 1),
    };
    const minimums = { work: 1, carry: 1, move: 1 };

    counts.move = Math.max(1, Math.ceil((counts.work + counts.carry) / 2));
    this.fitEconomicCounts(counts, minimums, energyCapacity, [
      "move",
      "carry",
      "work",
    ]);

    return this.finalizePlan(
      "remoteworker",
      "reserved_room_builder",
      this.buildEconomicBody(counts),
    );
  },

  planDismantlerBody(energyCapacity) {
    if (energyCapacity >= 1200) {
      return this.finalizePlan("dismantler", "heavy_breach", [
        TOUGH,
        TOUGH,
        TOUGH,
        TOUGH,
        WORK,
        WORK,
        WORK,
        WORK,
        WORK,
        WORK,
        MOVE,
        MOVE,
        MOVE,
        MOVE,
        MOVE,
        MOVE,
        MOVE,
        MOVE,
        MOVE,
        MOVE,
      ]);
    }

    if (energyCapacity >= 720) {
      return this.finalizePlan("dismantler", "breach", [
        TOUGH,
        TOUGH,
        WORK,
        WORK,
        WORK,
        WORK,
        MOVE,
        MOVE,
        MOVE,
        MOVE,
        MOVE,
        MOVE,
      ]);
    }

    if (energyCapacity >= 500) {
      return this.finalizePlan("dismantler", "light_breach", [
        WORK,
        WORK,
        WORK,
        MOVE,
        MOVE,
        MOVE,
      ]);
    }

    return this.finalizePlan("dismantler", "minimal_breach", [
      WORK,
      WORK,
      MOVE,
      MOVE,
    ]);
  },

  planAssaultBody(energyCapacity) {
    if (energyCapacity >= 780) {
      return this.finalizePlan("assault", "mixed_assault", [
        TOUGH,
        TOUGH,
        RANGED_ATTACK,
        RANGED_ATTACK,
        ATTACK,
        ATTACK,
        MOVE,
        MOVE,
        MOVE,
        MOVE,
        MOVE,
        MOVE,
      ]);
    }

    if (energyCapacity >= 430) {
      return this.finalizePlan("assault", "light_assault", [
        RANGED_ATTACK,
        ATTACK,
        MOVE,
        MOVE,
        MOVE,
      ]);
    }

    return this.finalizePlan("assault", "minimal_assault", [
      ATTACK,
      MOVE,
      MOVE,
    ]);
  },

  planCombatHealerBody(energyCapacity) {
    if (energyCapacity >= 1200) {
      return this.finalizePlan("combat_healer", "heavy_heal", [
        HEAL,
        HEAL,
        HEAL,
        MOVE,
        MOVE,
        MOVE,
      ]);
    }

    if (energyCapacity >= 600) {
      return this.finalizePlan("combat_healer", "heal_pair", [
        HEAL,
        HEAL,
        MOVE,
        MOVE,
      ]);
    }

    return this.finalizePlan("combat_healer", "single_heal", [
      HEAL,
      MOVE,
    ]);
  },

  planControllerAttackerBody(energyCapacity) {
    if (energyCapacity >= 1300) {
      return this.finalizePlan("controller_attacker", "fast_downgrade", [
        CLAIM,
        CLAIM,
        MOVE,
        MOVE,
      ]);
    }

    return this.finalizePlan("controller_attacker", "downgrade", [
      CLAIM,
      MOVE,
    ]);
  },

  getInfrastructure(room, state) {
    if (state && state.infrastructure) {
      return state.infrastructure;
    }

    return {
      hasStorage: !!(room && room.storage),
      storageEnergy:
        room && room.storage ? room.storage.store[RESOURCE_ENERGY] || 0 : 0,
      hasControllerLink: false,
      hasStorageLink: false,
      economyStage: state && state.phase ? state.phase : "bootstrap",
    };
  },

  getHaulerCarryDemand(room, request, state) {
    const incomePerTick = this.getConfiguredLimit("sourceIncomePerTick", 10);
    const roundTripBuffer = this.getConfiguredLimit("haulerRoundTripBuffer", 4);
    const defaultDemand = 4;
    const sourceId = request && request.sourceId ? request.sourceId : null;

    if (!room || !state || !sourceId) return defaultDemand;

    const source = _.find(state.sources || [], function (candidate) {
      return candidate.id === sourceId;
    });

    if (!source) return defaultDemand;

    const sourceContainer =
      state.sourceContainersBySourceId &&
      Object.prototype.hasOwnProperty.call(state.sourceContainersBySourceId, sourceId)
        ? state.sourceContainersBySourceId[sourceId]
        : null;
    const sourcePos = sourceContainer ? sourceContainer.pos : source.pos;
    const deliveryTarget = room.storage || (state.spawns && state.spawns[0]) || null;

    if (!deliveryTarget) {
      return defaultDemand;
    }

    const roundTripRange =
      sourcePos.getRangeTo(deliveryTarget.pos) * 2 + roundTripBuffer;

    return Math.max(2, Math.ceil((incomePerTick * roundTripRange) / 50));
  },

  fitEconomicCounts(counts, minimums, energyCapacity, reduceOrder) {
    let guard = 0;

    while (
      (this.getCountsCost(counts) > energyCapacity ||
        this.getCountsParts(counts) > 50) &&
      guard < 100
    ) {
      let reduced = false;

      for (let i = 0; i < reduceOrder.length; i++) {
        const key = reduceOrder[i];
        const min = Object.prototype.hasOwnProperty.call(minimums, key)
          ? minimums[key]
          : 0;

        if (counts[key] > min) {
          counts[key]--;
          reduced = true;
          break;
        }
      }

      if (!reduced) break;
      guard++;
    }
  },

  getCountsCost(counts) {
    return (
      counts.work * PART_COSTS[WORK] +
      counts.carry * PART_COSTS[CARRY] +
      counts.move * PART_COSTS[MOVE]
    );
  },

  getCountsParts(counts) {
    return counts.work + counts.carry + counts.move;
  },

  buildEconomicBody(counts) {
    const body = [];
    const normalized = this.normalizeCounts(counts);

    for (let i = 0; i < normalized.work; i++) {
      body.push(WORK);
    }

    for (let i = 0; i < normalized.carry; i++) {
      body.push(CARRY);
    }

    for (let i = 0; i < normalized.move; i++) {
      body.push(MOVE);
    }

    return body;
  },

  buildHaulerBody(counts) {
    const body = [];
    const normalized = this.normalizeCounts(counts);

    for (let i = 0; i < normalized.carry; i++) {
      body.push(CARRY);
    }

    for (let i = 0; i < normalized.move; i++) {
      body.push(MOVE);
    }

    return body;
  },

  finalizePlan(role, profile, body, extras) {
    const plan = Object.assign(
      {
        role: role,
        profile: profile,
        body: body,
        cost: this.getBodyCost(body),
        parts: body.length,
        workParts: this.countPart(body, WORK),
        carryParts: this.countPart(body, CARRY),
        moveParts: this.countPart(body, MOVE),
      },
      extras || {},
    );

    return plan;
  },

  getBodyCost(body) {
    let cost = 0;

    for (let i = 0; i < body.length; i++) {
      cost += PART_COSTS[body[i]] || 0;
    }

    return cost;
  },

  countPart(body, part) {
    let count = 0;

    for (let i = 0; i < body.length; i++) {
      if (body[i] === part) count++;
    }

    return count;
  },

  getEnergyCapacity(room, request) {
    const energyLimit = request && typeof request.energyLimit === "number"
      ? request.energyLimit
      : null;
    if (energyLimit !== null && Number.isFinite(energyLimit) && energyLimit > 0) {
      return Math.max(300, Math.floor(energyLimit));
    }

    const capacity = room && typeof room.energyCapacityAvailable === "number"
      ? room.energyCapacityAvailable
      : null;
    if (capacity !== null && Number.isFinite(capacity) && capacity > 0) {
      return Math.floor(capacity);
    }

    const available = room && typeof room.energyAvailable === "number"
      ? room.energyAvailable
      : null;
    if (available !== null && Number.isFinite(available) && available > 0) {
      return Math.max(300, Math.floor(available));
    }

    return 300;
  },

  normalizeCounts(counts) {
    return {
      work: this.normalizeCountValue(counts && counts.work),
      carry: this.normalizeCountValue(counts && counts.carry),
      move: this.normalizeCountValue(counts && counts.move),
    };
  },

  normalizeCountValue(value) {
    if (!Number.isFinite(value) || value <= 0) {
      return 0;
    }

    return Math.floor(value);
  },

  getConfiguredLimit(key, fallback) {
    if (
      config.BODIES &&
      Object.prototype.hasOwnProperty.call(config.BODIES, key) &&
      typeof config.BODIES[key] === "number"
    ) {
      return config.BODIES[key];
    }

    return fallback;
  },

  getThresholdWork(thresholds, energy, fallback) {
    let value = fallback;
    const normalizedThresholds = thresholds || [];

    for (let i = 0; i < normalizedThresholds.length; i++) {
      const threshold = normalizedThresholds[i];
      if (!threshold || typeof threshold.energy !== "number") continue;
      if (energy < threshold.energy) continue;
      if (typeof threshold.work === "number") {
        value = threshold.work;
      }
    }

    return value;
  },

  getControllerLinkReadyStorageEnergy() {
    return config.UPGRADING &&
      typeof config.UPGRADING.CONTROLLER_LINK_PROFILE_STORAGE_ENERGY === "number"
      ? config.UPGRADING.CONTROLLER_LINK_PROFILE_STORAGE_ENERGY
      : 20000;
  },

  getDefenderBody(energyCapacity, threatLevel, responseMode) {
    if (responseMode === "core_breach" && energyCapacity >= 760) {
      return [
        TOUGH,
        TOUGH,
        ATTACK,
        ATTACK,
        ATTACK,
        ATTACK,
        ATTACK,
        MOVE,
        MOVE,
        MOVE,
        MOVE,
        MOVE,
        MOVE,
      ];
    }

    var prefersTowerSupport =
      responseMode === "tower_support" || responseMode === "creep_only";

    if (prefersTowerSupport && energyCapacity >= 780) {
      return [
        TOUGH,
        TOUGH,
        RANGED_ATTACK,
        RANGED_ATTACK,
        ATTACK,
        ATTACK,
        MOVE,
        MOVE,
        MOVE,
        MOVE,
        MOVE,
        MOVE,
      ];
    }

    if (prefersTowerSupport && energyCapacity >= 630) {
      return [
        RANGED_ATTACK,
        RANGED_ATTACK,
        ATTACK,
        MOVE,
        MOVE,
        MOVE,
        MOVE,
        MOVE,
      ];
    }

    if (prefersTowerSupport && energyCapacity >= 430) {
      return [RANGED_ATTACK, ATTACK, MOVE, MOVE, MOVE];
    }

    if (energyCapacity >= 1000 && threatLevel >= 3) {
      return [
        TOUGH,
        TOUGH,
        TOUGH,
        TOUGH,
        ATTACK,
        ATTACK,
        ATTACK,
        ATTACK,
        ATTACK,
        ATTACK,
        MOVE,
        MOVE,
        MOVE,
        MOVE,
        MOVE,
        MOVE,
        MOVE,
      ];
    }

    if (energyCapacity >= 760 && threatLevel >= 2) {
      return [
        TOUGH,
        TOUGH,
        ATTACK,
        ATTACK,
        ATTACK,
        ATTACK,
        ATTACK,
        MOVE,
        MOVE,
        MOVE,
        MOVE,
        MOVE,
        MOVE,
      ];
    }

    if (energyCapacity >= 590) {
      return [TOUGH, ATTACK, ATTACK, ATTACK, ATTACK, MOVE, MOVE, MOVE, MOVE];
    }

    if (energyCapacity >= 430) {
      return [ATTACK, ATTACK, MOVE, MOVE, MOVE];
    }

    return [ATTACK, MOVE, MOVE];
  },
};
