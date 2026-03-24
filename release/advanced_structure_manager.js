const config = require("config");

var cachedTick = null;
var cachedPlanByRoom = {};
var reverseReactions = null;

function resetCacheIfNeeded() {
  if (cachedTick === Game.time) return;

  cachedTick = Game.time;
  cachedPlanByRoom = {};
}

module.exports = {
  run(room, state) {
    if (!room.controller || room.controller.level < 6) {
      return this.getEmptySummary();
    }

    var plan = this.getPlan(room, state);
    this.runLabs(plan);
    this.runFactory(plan);
    this.getRoomMemory(room).summary = plan.summary;
    return plan.summary;
  },

  getStatus(room, state) {
    if (!room.controller || room.controller.level < 6) {
      return this.getEmptySummary();
    }

    var plan = this.getPlan(room, state);
    return plan.summary;
  },

  getHaulerTask(room, creep, state) {
    if (!this.shouldAllowHaulerAdvancedTask(room, creep, state)) return null;

    var cachedTask = creep.memory.advancedTask || null;
    if (cachedTask && this.isTaskValid(cachedTask)) {
      return cachedTask;
    }

    delete creep.memory.advancedTask;

    var plan = this.getPlan(room, state);
    if (!plan.task || !this.isTaskValid(plan.task)) return null;

    var memory = this.getRoomMemory(room);
    var taskKey = this.getTaskKey(plan.task);
    var claim = memory.taskClaim || null;
    if (
      claim &&
      claim.key === taskKey &&
      claim.creep !== creep.name &&
      claim.until >= Game.time
    ) {
      return null;
    }

    memory.taskClaim = {
      key: taskKey,
      creep: creep.name,
      until: Game.time + this.getTaskLockTtl(),
    };

    creep.memory.advancedTask = this.cloneTask(plan.task);
    return creep.memory.advancedTask;
  },

  clearHaulerTask(creep) {
    delete creep.memory.advancedTask;
  },

  shouldAllowHaulerAdvancedTask(room, creep, state) {
    if (!room.storage) return false;

    var totalCarry = creep.store.getUsedCapacity();
    if (totalCarry > 0) return false;
    if ((room.storage.store[RESOURCE_ENERGY] || 0) < this.getMinStorageEnergy()) {
      return false;
    }
    if (room.energyAvailable < room.energyCapacityAvailable) return false;
    if (state && state.hostileCreeps && state.hostileCreeps.length > 0) {
      return false;
    }

    return true;
  },

  getPlan(room, state) {
    resetCacheIfNeeded();

    if (cachedPlanByRoom[room.name]) {
      return cachedPlanByRoom[room.name];
    }

    var memory = this.getRoomMemory(room);
    var structuresByType =
      state && state.structuresByType ? state.structuresByType : {};
    var terminal = structuresByType[STRUCTURE_TERMINAL]
      ? structuresByType[STRUCTURE_TERMINAL][0]
      : null;
    var storage = room.storage ||
      (structuresByType[STRUCTURE_STORAGE] ? structuresByType[STRUCTURE_STORAGE][0] : null);
    var labs = structuresByType[STRUCTURE_LAB] || [];
    var factories = structuresByType[STRUCTURE_FACTORY] || [];
    var factory = factories.length > 0 ? factories[0] : null;
    var powerSpawns = structuresByType[STRUCTURE_POWER_SPAWN] || [];
    var powerSpawn = powerSpawns.length > 0 ? powerSpawns[0] : null;
    var nukers = structuresByType[STRUCTURE_NUKER] || [];
    var nuker = nukers.length > 0 ? nukers[0] : null;

    var plan = {
      room: room,
      state: state,
      storage: storage,
      terminal: terminal,
      labs: labs,
      factory: factory,
      powerSpawn: powerSpawn,
      nuker: nuker,
      lab: this.buildLabPlan(room, labs, storage, terminal, memory),
      factoryPlan: this.buildFactoryPlan(room, factory, storage, terminal),
      powerSpawnPlan: this.buildPowerSpawnPlan(powerSpawn, storage, terminal),
      nukerPlan: this.buildNukerPlan(nuker, storage, terminal),
      taskCandidates: {},
      task: null,
      summary: this.getEmptySummary(),
    };

    plan.taskCandidates = this.buildTaskCandidates(plan);
    plan.task = this.chooseTask(plan.taskCandidates);
    plan.summary = this.buildSummary(plan);
    cachedPlanByRoom[room.name] = plan;
    return plan;
  },

  buildLabPlan(room, labs, storage, terminal, memory) {
    var labsConfig = config.ADVANCED && config.ADVANCED.LABS
      ? config.ADVANCED.LABS
      : {};

    if (labsConfig.ENABLED === false || labs.length < 3) {
      memory.labLayout = null;
      memory.labProduct = null;
      return {
        enabled: false,
        status: "inactive",
        product: null,
        reagentA: null,
        reagentB: null,
        inputIds: [],
        reactorIds: [],
      };
    }

    var layout = this.getLabLayout(room, labs, memory);
    if (!layout || layout.reactorIds.length <= 0) {
      memory.labProduct = null;
      return {
        enabled: false,
        status: "no_cluster",
        product: null,
        reagentA: null,
        reagentB: null,
        inputIds: [],
        reactorIds: [],
      };
    }

    var currentReaction = this.getCurrentLabReaction(layout.inputIds);
    var preferredProduct = memory.labProduct || null;
    var desiredReaction = null;

    if (currentReaction && this.canSupplyReaction(currentReaction.product, storage, terminal)) {
      desiredReaction = currentReaction;
    } else if (
      preferredProduct &&
      this.canSupplyReaction(preferredProduct, storage, terminal)
    ) {
      desiredReaction = this.getReactionInputsForProduct(preferredProduct);
    } else {
      desiredReaction = this.chooseReaction(storage, terminal);
    }

    memory.labProduct = desiredReaction ? desiredReaction.product : null;

    return {
      enabled: true,
      status: desiredReaction ? "ready" : "idle",
      product: desiredReaction ? desiredReaction.product : null,
      reagentA: desiredReaction ? desiredReaction.reagentA : null,
      reagentB: desiredReaction ? desiredReaction.reagentB : null,
      inputIds: layout.inputIds.slice(),
      reactorIds: layout.reactorIds.slice(),
    };
  },

  getLabLayout(room, labs, memory) {
    var ids = [];
    for (var i = 0; i < labs.length; i++) {
      ids.push(labs[i].id);
    }
    ids.sort();

    var signature = ids.join(":");
    if (
      memory.labLayout &&
      memory.labLayout.signature === signature &&
      memory.labLayout.inputIds &&
      memory.labLayout.reactorIds
    ) {
      return memory.labLayout;
    }

    var anchor = room.storage || room.terminal || room.find(FIND_MY_SPAWNS)[0] || null;
    var best = null;

    for (var a = 0; a < labs.length; a++) {
      for (var b = a + 1; b < labs.length; b++) {
        if (labs[a].pos.getRangeTo(labs[b]) > 2) continue;

        var reactors = [];
        for (var c = 0; c < labs.length; c++) {
          if (c === a || c === b) continue;

          if (
            labs[c].pos.getRangeTo(labs[a]) <= 2 &&
            labs[c].pos.getRangeTo(labs[b]) <= 2
          ) {
            reactors.push(labs[c]);
          }
        }

        var rangeScore = anchor
          ? labs[a].pos.getRangeTo(anchor) + labs[b].pos.getRangeTo(anchor)
          : 0;
        var score = reactors.length * 100 - rangeScore;

        if (!best || score > best.score) {
          best = {
            score: score,
            inputIds: [labs[a].id, labs[b].id],
            reactorIds: _.map(reactors, "id"),
          };
        }
      }
    }

    memory.labLayout = best
      ? {
          signature: signature,
          inputIds: best.inputIds.slice(),
          reactorIds: best.reactorIds.slice(),
        }
      : null;

    return memory.labLayout;
  },

  getCurrentLabReaction(inputIds) {
    if (!inputIds || inputIds.length < 2) return null;

    var inputA = Game.getObjectById(inputIds[0]);
    var inputB = Game.getObjectById(inputIds[1]);
    if (!inputA || !inputB) return null;

    var reagentA = this.getPrimaryStoredResource(inputA);
    var reagentB = this.getPrimaryStoredResource(inputB);
    if (!reagentA || !reagentB) return null;

    var product = this.getReactionProduct(reagentA, reagentB);
    if (!product) return null;

    return {
      product: product,
      reagentA: reagentA,
      reagentB: reagentB,
    };
  },

  chooseReaction(storage, terminal) {
    var labsConfig = config.ADVANCED && config.ADVANCED.LABS
      ? config.ADVANCED.LABS
      : {};
    var priorities = labsConfig.PRODUCT_PRIORITY || [];

    for (var i = 0; i < priorities.length; i++) {
      var reaction = this.getReactionInputsForProduct(priorities[i]);
      if (!reaction) continue;
      if (this.canSupplyReaction(reaction.product, storage, terminal)) {
        return reaction;
      }
    }

    return null;
  },

  canSupplyReaction(product, storage, terminal) {
    var reaction = this.getReactionInputsForProduct(product);
    if (!reaction) return false;

    var minimum = this.getLabStartMinimum();
    var availableA = this.getHubResourceAmount(storage, terminal, reaction.reagentA);
    var availableB = this.getHubResourceAmount(storage, terminal, reaction.reagentB);

    return availableA >= minimum && availableB >= minimum;
  },

  getReactionInputsForProduct(product) {
    var reverse = this.getReverseReactions();
    if (!reverse[product]) return null;

    return {
      product: product,
      reagentA: reverse[product].reagentA,
      reagentB: reverse[product].reagentB,
    };
  },

  getReverseReactions() {
    if (reverseReactions) return reverseReactions;

    reverseReactions = {};

    for (var reagentA in REACTIONS) {
      if (!Object.prototype.hasOwnProperty.call(REACTIONS, reagentA)) continue;

      for (var reagentB in REACTIONS[reagentA]) {
        if (!Object.prototype.hasOwnProperty.call(REACTIONS[reagentA], reagentB)) continue;

        var product = REACTIONS[reagentA][reagentB];
        if (!reverseReactions[product]) {
          reverseReactions[product] = {
            reagentA: reagentA,
            reagentB: reagentB,
          };
        }
      }
    }

    return reverseReactions;
  },

  getReactionProduct(reagentA, reagentB) {
    if (REACTIONS[reagentA] && REACTIONS[reagentA][reagentB]) {
      return REACTIONS[reagentA][reagentB];
    }
    if (REACTIONS[reagentB] && REACTIONS[reagentB][reagentA]) {
      return REACTIONS[reagentB][reagentA];
    }

    return null;
  },

  buildFactoryPlan(room, factory, storage, terminal) {
    var factoryConfig = config.ADVANCED && config.ADVANCED.FACTORY
      ? config.ADVANCED.FACTORY
      : {};

    if (factoryConfig.ENABLED === false || !factory) {
      return {
        enabled: false,
        status: "inactive",
        product: null,
        factoryId: null,
      };
    }

    var products = factoryConfig.PRODUCT_PRIORITY || [];
    var storageEnergy = storage ? storage.store[RESOURCE_ENERGY] || 0 : 0;
    var chosen = null;

    for (var i = 0; i < products.length; i++) {
      if (
        products[i] === "battery" &&
        storageEnergy >= (factoryConfig.MIN_STORAGE_ENERGY || 50000) &&
        typeof COMMODITIES !== "undefined" &&
        COMMODITIES[products[i]]
      ) {
        chosen = products[i];
        break;
      }
    }

    return {
      enabled: true,
      status: chosen ? "ready" : "idle",
      product: chosen,
      factoryId: factory.id,
    };
  },

  buildPowerSpawnPlan(powerSpawn, storage, terminal) {
    if (
      !powerSpawn ||
      (config.ADVANCED &&
        config.ADVANCED.POWER_SPAWN &&
        config.ADVANCED.POWER_SPAWN.ENABLED === false)
    ) {
      return {
        enabled: false,
        status: "inactive",
        powerSpawnId: null,
      };
    }

    var hubPower = this.getHubResourceAmount(storage, terminal, RESOURCE_POWER);
    var storageEnergy = storage ? storage.store[RESOURCE_ENERGY] || 0 : 0;
    var status = "idle";

    if (hubPower > 0 || storageEnergy >= this.getPowerSpawnMinStorageEnergy()) {
      status = "staging";
    }
    if (
      hubPower > 0 &&
      storageEnergy >= this.getPowerSpawnMinStorageEnergy()
    ) {
      status = "ready";
    }

    return {
      enabled: true,
      status: status,
      powerSpawnId: powerSpawn.id,
    };
  },

  buildNukerPlan(nuker, storage, terminal) {
    if (
      !nuker ||
      (config.ADVANCED &&
        config.ADVANCED.NUKER &&
        config.ADVANCED.NUKER.ENABLED === false)
    ) {
      return {
        enabled: false,
        status: "inactive",
        nukerId: null,
      };
    }

    var hubGhodium = this.getHubResourceAmount(storage, terminal, RESOURCE_GHODIUM);
    var storageEnergy = storage ? storage.store[RESOURCE_ENERGY] || 0 : 0;
    var status = "idle";

    if (hubGhodium > 0 || storageEnergy >= this.getNukerMinStorageEnergy()) {
      status = "staging";
    }
    if (hubGhodium > 0 && storageEnergy >= this.getNukerMinStorageEnergy()) {
      status = "ready";
    }

    return {
      enabled: true,
      status: status,
      nukerId: nuker.id,
    };
  },

  buildTaskCandidates(plan) {
    var tasks = {};
    this.addLabTaskCandidates(tasks, plan);
    this.addFactoryTaskCandidates(tasks, plan);
    this.addPowerSpawnTaskCandidates(tasks, plan);
    this.addNukerTaskCandidates(tasks, plan);
    return tasks;
  },

  chooseTask(tasks) {
    var priorities = this.getHaulTaskPriority();

    for (var i = 0; i < priorities.length; i++) {
      var label = priorities[i];
      if (tasks[label] && this.isTaskValid(tasks[label])) {
        return tasks[label];
      }
    }

    for (var taskLabel in tasks) {
      if (!Object.prototype.hasOwnProperty.call(tasks, taskLabel)) continue;
      if (tasks[taskLabel] && this.isTaskValid(tasks[taskLabel])) {
        return tasks[taskLabel];
      }
    }

    return null;
  },

  addTaskCandidate(tasks, task) {
    if (!task || !task.label || tasks[task.label]) return;
    tasks[task.label] = task;
  },

  addLabTaskCandidates(tasks, plan) {
    var labPlan = plan.lab;
    if (!labPlan.enabled) return;

    var inputA = Game.getObjectById(labPlan.inputIds[0]);
    var inputB = Game.getObjectById(labPlan.inputIds[1]);
    var reactors = this.getObjectsByIds(labPlan.reactorIds);
    var hubOut = this.getOutputHub(plan.storage, plan.terminal);

    if (!hubOut) return;

    this.addTaskCandidate(
      tasks,
      this.getLabCleanupTask([inputA, inputB].concat(reactors), labPlan, hubOut),
    );
    if (!labPlan.product) return;

    this.addTaskCandidate(
      tasks,
      this.getLabUnloadTask(reactors, labPlan.product, hubOut),
    );
    this.addTaskCandidate(
      tasks,
      this.getLabFillTask(inputA, labPlan.reagentA, plan.storage, plan.terminal),
    );
    this.addTaskCandidate(
      tasks,
      this.getLabFillTask(inputB, labPlan.reagentB, plan.storage, plan.terminal),
    );
  },

  addFactoryTaskCandidates(tasks, plan) {
    this.addTaskCandidate(tasks, this.getFactoryOutputTask(plan));
    this.addTaskCandidate(tasks, this.getFactoryInputTask(plan));
    this.addTaskCandidate(tasks, this.getFactoryEnergyTask(plan));
  },

  addPowerSpawnTaskCandidates(tasks, plan) {
    this.addTaskCandidate(tasks, this.getPowerSpawnPowerTask(plan));
    this.addTaskCandidate(tasks, this.getPowerSpawnEnergyTask(plan));
  },

  addNukerTaskCandidates(tasks, plan) {
    this.addTaskCandidate(tasks, this.getNukerGhodiumTask(plan));
    this.addTaskCandidate(tasks, this.getNukerEnergyTask(plan));
  },

  buildLabTask(plan) {
    var labPlan = plan.lab;
    if (!labPlan.enabled) return null;

    var inputA = Game.getObjectById(labPlan.inputIds[0]);
    var inputB = Game.getObjectById(labPlan.inputIds[1]);
    var reactors = this.getObjectsByIds(labPlan.reactorIds);
    var hubOut = this.getOutputHub(plan.storage, plan.terminal);

    if (!hubOut) return null;

    var cleanupTask = this.getLabCleanupTask(
      [inputA, inputB].concat(reactors),
      labPlan,
      hubOut,
    );
    if (cleanupTask) return cleanupTask;

    if (!labPlan.product) return null;

    var unloadTask = this.getLabUnloadTask(reactors, labPlan.product, hubOut);
    if (unloadTask) return unloadTask;

    var fillTask = this.getLabFillTask(inputA, labPlan.reagentA, plan.storage, plan.terminal);
    if (fillTask) return fillTask;

    return this.getLabFillTask(inputB, labPlan.reagentB, plan.storage, plan.terminal);
  },

  getLabCleanupTask(labs, labPlan, delivery) {
    for (var i = 0; i < labs.length; i++) {
      var lab = labs[i];
      if (!lab) continue;

      var resourceType = this.getPrimaryStoredResource(lab);
      if (!resourceType) continue;

      var expected = null;
      if (labPlan.inputIds.indexOf(lab.id) !== -1) {
        expected = lab.id === labPlan.inputIds[0] ? labPlan.reagentA : labPlan.reagentB;
      } else {
        expected = labPlan.product;
      }

      if (resourceType !== expected) {
        return this.createTask(
          "lab_cleanup",
          lab,
          delivery,
          resourceType,
          this.getStoredAmount(lab, resourceType),
        );
      }
    }

    return null;
  },

  getLabUnloadTask(reactors, product, delivery) {
    var unloadAt = this.getLabOutputUnloadAt();
    var reactionAmount = this.getLabReactionAmount();

    for (var i = 0; i < reactors.length; i++) {
      var reactor = reactors[i];
      if (!reactor) continue;

      var amount = this.getStoredAmount(reactor, product);
      if (amount <= 0) continue;

      if (
        amount >= unloadAt ||
        this.getFreeCapacity(reactor, product) < reactionAmount
      ) {
        return this.createTask("lab_output", reactor, delivery, product, amount);
      }
    }

    return null;
  },

  getLabFillTask(lab, resourceType, storage, terminal) {
    if (!lab || !resourceType) return null;

    var current = this.getStoredAmount(lab, resourceType);
    var target = this.getLabInputTarget();
    if (current >= target) return null;

    var pickup = this.getPickupHub(resourceType, storage, terminal);
    if (!pickup) return null;

    var available = this.getStoredAmount(pickup, resourceType);
    if (available <= 0) return null;

    return this.createTask(
      "lab_input",
      pickup,
      lab,
      resourceType,
      Math.min(target - current, available),
    );
  },

  buildFactoryTask(plan) {
    return this.getFactoryOutputTask(plan) || this.getFactoryEnergyTask(plan);
  },

  getFactoryOutputTask(plan) {
    var factoryPlan = plan.factoryPlan;
    if (!factoryPlan.enabled) return null;

    var factory = Game.getObjectById(factoryPlan.factoryId);
    if (!factory) return null;

    var delivery = this.getOutputHub(plan.storage, plan.terminal);
    if (!delivery) return null;

    var recipe = this.getFactoryRecipe(factoryPlan.product);
    var resources = this.getStoredResourceTypes(factory);

    for (var i = 0; i < resources.length; i++) {
      var resourceType = resources[i];
      if (resourceType === RESOURCE_ENERGY) continue;

      var amount = this.getStoredAmount(factory, resourceType);
      if (amount <= 0) continue;

      if (resourceType === factoryPlan.product) {
        if (amount >= this.getFactoryExportBatch()) {
          return this.createTask(
            "factory_output",
            factory,
            delivery,
            resourceType,
            amount,
          );
        }
        continue;
      }

      if (!recipe || !recipe.components || !recipe.components[resourceType]) {
        return this.createTask(
          "factory_output",
          factory,
          delivery,
          resourceType,
          amount,
        );
      }
    }

    return null;
  },

  getFactoryInputTask(plan) {
    var factoryPlan = plan.factoryPlan;
    if (!factoryPlan.enabled || !factoryPlan.product) return null;

    var factory = Game.getObjectById(factoryPlan.factoryId);
    if (!factory) return null;

    var recipe = this.getFactoryRecipe(factoryPlan.product);
    if (!recipe || !recipe.components) return null;

    for (var resourceType in recipe.components) {
      if (!Object.prototype.hasOwnProperty.call(recipe.components, resourceType)) continue;
      if (resourceType === RESOURCE_ENERGY) continue;

      var current = this.getStoredAmount(factory, resourceType);
      var target = recipe.components[resourceType];
      if (current >= target) continue;

      var pickup = this.getPickupHub(resourceType, plan.storage, plan.terminal);
      if (!pickup) continue;

      var available = this.getStoredAmount(pickup, resourceType);
      if (available <= 0) continue;

      return this.createTask(
        "factory_input",
        pickup,
        factory,
        resourceType,
        Math.min(target - current, available),
      );
    }

    return null;
  },

  getFactoryEnergyTask(plan) {
    var factoryPlan = plan.factoryPlan;
    if (!factoryPlan.enabled || !factoryPlan.product) return null;

    var factory = Game.getObjectById(factoryPlan.factoryId);
    if (!factory) return null;

    var recipe = this.getFactoryRecipe(factoryPlan.product);
    if (!recipe || !recipe.components) return null;

    var energyNeeded = recipe.components[RESOURCE_ENERGY] || 0;
    var currentEnergy = this.getStoredAmount(factory, RESOURCE_ENERGY);
    var targetEnergy = Math.max(energyNeeded, this.getFactoryEnergyTarget());
    var pickup =
      plan.storage &&
      (plan.storage.store[RESOURCE_ENERGY] || 0) >= this.getFactoryMinStorageEnergy()
        ? plan.storage
        : null;

    if (!pickup || currentEnergy >= targetEnergy) return null;

    return this.createTask(
      "factory_energy",
      pickup,
      factory,
      RESOURCE_ENERGY,
      Math.min(targetEnergy - currentEnergy, pickup.store[RESOURCE_ENERGY] || 0),
    );
  },

  buildFactoryInputTask(plan) {
    return this.getFactoryInputTask(plan);
  },

  buildPowerSpawnTask(plan) {
    return this.getPowerSpawnPowerTask(plan) || this.getPowerSpawnEnergyTask(plan);
  },

  getPowerSpawnPowerTask(plan) {
    var powerSpawnPlan = plan.powerSpawnPlan;
    if (!powerSpawnPlan.enabled) return null;

    var powerSpawn = Game.getObjectById(powerSpawnPlan.powerSpawnId);
    if (!powerSpawn) return null;

    var powerPickup = this.getPickupHub(RESOURCE_POWER, plan.storage, plan.terminal);
    if (!powerPickup) return null;
    if (
      this.getStoredAmount(powerSpawn, RESOURCE_POWER) >=
      this.getPowerSpawnPowerTarget()
    ) {
      return null;
    }

    return this.createTask(
      "power_spawn_power",
      powerPickup,
      powerSpawn,
      RESOURCE_POWER,
      Math.min(
        this.getPowerSpawnPowerTarget() -
          this.getStoredAmount(powerSpawn, RESOURCE_POWER),
        this.getStoredAmount(powerPickup, RESOURCE_POWER),
      ),
    );
  },

  getPowerSpawnEnergyTask(plan) {
    var powerSpawnPlan = plan.powerSpawnPlan;
    if (!powerSpawnPlan.enabled) return null;

    var powerSpawn = Game.getObjectById(powerSpawnPlan.powerSpawnId);
    if (!powerSpawn) return null;

    if (
      !plan.storage ||
      (plan.storage.store[RESOURCE_ENERGY] || 0) < this.getPowerSpawnMinStorageEnergy()
    ) {
      return null;
    }
    if (
      this.getStoredAmount(powerSpawn, RESOURCE_ENERGY) >=
      this.getPowerSpawnEnergyTarget()
    ) {
      return null;
    }

    return this.createTask(
      "power_spawn_energy",
      plan.storage,
      powerSpawn,
      RESOURCE_ENERGY,
      Math.min(
        this.getPowerSpawnEnergyTarget() -
          this.getStoredAmount(powerSpawn, RESOURCE_ENERGY),
        plan.storage.store[RESOURCE_ENERGY] || 0,
      ),
    );
  },

  buildNukerTask(plan) {
    return this.getNukerGhodiumTask(plan) || this.getNukerEnergyTask(plan);
  },

  getNukerGhodiumTask(plan) {
    var nukerPlan = plan.nukerPlan;
    if (!nukerPlan.enabled) return null;

    var nuker = Game.getObjectById(nukerPlan.nukerId);
    if (!nuker) return null;

    var ghodiumPickup = this.getPickupHub(RESOURCE_GHODIUM, plan.storage, plan.terminal);
    if (!ghodiumPickup) return null;
    if (
      this.getStoredAmount(nuker, RESOURCE_GHODIUM) >=
      this.getNukerGhodiumTarget()
    ) {
      return null;
    }

    return this.createTask(
      "nuker_ghodium",
      ghodiumPickup,
      nuker,
      RESOURCE_GHODIUM,
      Math.min(
        this.getNukerGhodiumTarget() -
          this.getStoredAmount(nuker, RESOURCE_GHODIUM),
        this.getStoredAmount(ghodiumPickup, RESOURCE_GHODIUM),
      ),
    );
  },

  getNukerEnergyTask(plan) {
    var nukerPlan = plan.nukerPlan;
    if (!nukerPlan.enabled) return null;

    var nuker = Game.getObjectById(nukerPlan.nukerId);
    if (!nuker) return null;

    if (
      !plan.storage ||
      (plan.storage.store[RESOURCE_ENERGY] || 0) < this.getNukerMinStorageEnergy()
    ) {
      return null;
    }
    if (this.getStoredAmount(nuker, RESOURCE_ENERGY) >= this.getNukerEnergyTarget()) {
      return null;
    }

    return this.createTask(
      "nuker_energy",
      plan.storage,
      nuker,
      RESOURCE_ENERGY,
      Math.min(
        this.getNukerEnergyTarget() - this.getStoredAmount(nuker, RESOURCE_ENERGY),
        plan.storage.store[RESOURCE_ENERGY] || 0,
      ),
    );
  },

  buildSummary(plan) {
    return {
      labStatus: plan.lab.status,
      labProduct: plan.lab.product || null,
      factoryStatus: plan.factoryPlan.status,
      factoryProduct: plan.factoryPlan.product || null,
      powerSpawnStatus: plan.powerSpawnPlan.status,
      nukerStatus: plan.nukerPlan.status,
      taskLabel: plan.task ? plan.task.label : null,
    };
  },

  runLabs(plan) {
    var labPlan = plan.lab;
    if (!labPlan.enabled || !labPlan.product) return;

    var inputA = Game.getObjectById(labPlan.inputIds[0]);
    var inputB = Game.getObjectById(labPlan.inputIds[1]);
    var reactors = this.getObjectsByIds(labPlan.reactorIds);

    if (
      !inputA ||
      !inputB ||
      this.getPrimaryStoredResource(inputA) !== labPlan.reagentA ||
      this.getPrimaryStoredResource(inputB) !== labPlan.reagentB ||
      this.getStoredAmount(inputA, labPlan.reagentA) < this.getLabReactionAmount() ||
      this.getStoredAmount(inputB, labPlan.reagentB) < this.getLabReactionAmount()
    ) {
      return;
    }

    for (var i = 0; i < reactors.length; i++) {
      var reactor = reactors[i];
      if (!reactor || reactor.cooldown > 0) continue;

      var primary = this.getPrimaryStoredResource(reactor);
      if (primary && primary !== labPlan.product) continue;
      if (this.getFreeCapacity(reactor, labPlan.product) < this.getLabReactionAmount()) {
        continue;
      }

      reactor.runReaction(inputA, inputB);
    }
  },

  runFactory(plan) {
    var factoryPlan = plan.factoryPlan;
    if (!factoryPlan.enabled || !factoryPlan.product) return;

    var factory = Game.getObjectById(factoryPlan.factoryId);
    if (!factory || factory.cooldown > 0) return;

    var recipe = typeof COMMODITIES !== "undefined" ? COMMODITIES[factoryPlan.product] : null;
    if (!recipe || !recipe.components) return;

    for (var resourceType in recipe.components) {
      if (!Object.prototype.hasOwnProperty.call(recipe.components, resourceType)) continue;
      if (this.getStoredAmount(factory, resourceType) < recipe.components[resourceType]) {
        return;
      }
    }

    factory.produce(factoryPlan.product);
  },

  getOutputHub(storage, terminal) {
    if (terminal && terminal.store.getFreeCapacity() > 0) return terminal;
    if (storage && storage.store.getFreeCapacity() > 0) return storage;
    return terminal || storage || null;
  },

  getPickupHub(resourceType, storage, terminal) {
    if (terminal && this.getStoredAmount(terminal, resourceType) > 0) {
      return terminal;
    }
    if (storage && this.getStoredAmount(storage, resourceType) > 0) {
      return storage;
    }
    return null;
  },

  getHubResourceAmount(storage, terminal, resourceType) {
    return (
      this.getStoredAmount(storage, resourceType) +
      this.getStoredAmount(terminal, resourceType)
    );
  },

  getObjectsByIds(ids) {
    var objects = [];

    for (var i = 0; i < ids.length; i++) {
      var object = Game.getObjectById(ids[i]);
      if (object) objects.push(object);
    }

    return objects;
  },

  getStoredResourceTypes(structure) {
    var resources = [];
    if (!structure || !structure.store) return resources;

    for (var resourceType in structure.store) {
      if (!Object.prototype.hasOwnProperty.call(structure.store, resourceType)) continue;
      if (this.getStoredAmount(structure, resourceType) <= 0) continue;
      resources.push(resourceType);
    }

    return resources;
  },

  createTask(label, pickup, delivery, resourceType, amount) {
    if (!pickup || !delivery || !resourceType || amount <= 0) return null;

    return {
      label: label,
      pickupId: pickup.id,
      deliveryId: delivery.id,
      resourceType: resourceType,
      amount: amount,
    };
  },

  isTaskValid(task) {
    if (!task) return false;
    if (typeof task.amount === "number" && task.amount <= 0) return false;

    var pickup = Game.getObjectById(task.pickupId);
    var delivery = Game.getObjectById(task.deliveryId);
    if (!pickup || !delivery) return false;

    if (this.getStoredAmount(pickup, task.resourceType) <= 0) return false;
    if (this.getFreeCapacity(delivery, task.resourceType) <= 0) return false;

    return true;
  },

  cloneTask(task) {
    return {
      label: task.label,
      pickupId: task.pickupId,
      deliveryId: task.deliveryId,
      resourceType: task.resourceType,
      amount: task.amount,
    };
  },

  getTaskKey(task) {
    return [
      task.label,
      task.pickupId,
      task.deliveryId,
      task.resourceType,
    ].join(":");
  },

  getPrimaryStoredResource(structure) {
    if (!structure || !structure.store) return null;

    if (
      typeof structure.mineralType !== "undefined" &&
      structure.mineralType &&
      this.getStoredAmount(structure, structure.mineralType) > 0
    ) {
      return structure.mineralType;
    }

    for (var resourceType in structure.store) {
      if (!Object.prototype.hasOwnProperty.call(structure.store, resourceType)) continue;
      if (resourceType === RESOURCE_ENERGY) continue;
      if (this.getStoredAmount(structure, resourceType) > 0) {
        return resourceType;
      }
    }

    return null;
  },

  getStoredAmount(structure, resourceType) {
    if (!structure || !structure.store) return 0;
    if (typeof structure.store.getUsedCapacity === "function") {
      var used = structure.store.getUsedCapacity(resourceType);
      if (typeof used === "number" && used > 0) return used;
    }

    return structure.store[resourceType] || 0;
  },

  getFreeCapacity(structure, resourceType) {
    if (!structure || !structure.store) return 0;
    if (typeof structure.store.getFreeCapacity === "function") {
      return structure.store.getFreeCapacity(resourceType);
    }

    return 0;
  },

  getFactoryRecipe(product) {
    return typeof COMMODITIES !== "undefined" && product
      ? COMMODITIES[product] || null
      : null;
  },

  getHaulTaskPriority() {
    if (
      config.ADVANCED &&
      config.ADVANCED.HAUL_TASK_PRIORITY &&
      config.ADVANCED.HAUL_TASK_PRIORITY.length > 0
    ) {
      return config.ADVANCED.HAUL_TASK_PRIORITY;
    }

    return [
      "lab_cleanup",
      "lab_output",
      "lab_input",
      "factory_output",
      "factory_input",
      "factory_energy",
      "power_spawn_power",
      "power_spawn_energy",
      "nuker_ghodium",
      "nuker_energy",
    ];
  },

  getRoomMemory(room) {
    if (!Memory.rooms) Memory.rooms = {};
    if (!Memory.rooms[room.name]) Memory.rooms[room.name] = {};
    if (!Memory.rooms[room.name].advancedOps) {
      Memory.rooms[room.name].advancedOps = {};
    }

    return Memory.rooms[room.name].advancedOps;
  },

  getLabInputTarget() {
    return config.ADVANCED && config.ADVANCED.LABS
      ? config.ADVANCED.LABS.INPUT_TARGET || 500
      : 500;
  },

  getLabStartMinimum() {
    return config.ADVANCED && config.ADVANCED.LABS
      ? config.ADVANCED.LABS.INPUT_START_MIN || 100
      : 100;
  },

  getLabOutputUnloadAt() {
    return config.ADVANCED && config.ADVANCED.LABS
      ? config.ADVANCED.LABS.OUTPUT_UNLOAD_AT || 250
      : 250;
  },

  getFactoryMinStorageEnergy() {
    return config.ADVANCED && config.ADVANCED.FACTORY
      ? config.ADVANCED.FACTORY.MIN_STORAGE_ENERGY || 50000
      : 50000;
  },

  getFactoryEnergyTarget() {
    return config.ADVANCED && config.ADVANCED.FACTORY
      ? config.ADVANCED.FACTORY.FACTORY_ENERGY_TARGET || 1200
      : 1200;
  },

  getFactoryExportBatch() {
    return config.ADVANCED && config.ADVANCED.FACTORY
      ? config.ADVANCED.FACTORY.EXPORT_BATCH || 100
      : 100;
  },

  getPowerSpawnMinStorageEnergy() {
    return config.ADVANCED && config.ADVANCED.POWER_SPAWN
      ? config.ADVANCED.POWER_SPAWN.MIN_STORAGE_ENERGY || 100000
      : 100000;
  },

  getPowerSpawnEnergyTarget() {
    return config.ADVANCED && config.ADVANCED.POWER_SPAWN
      ? config.ADVANCED.POWER_SPAWN.ENERGY_TARGET || 3000
      : 3000;
  },

  getPowerSpawnPowerTarget() {
    return config.ADVANCED && config.ADVANCED.POWER_SPAWN
      ? config.ADVANCED.POWER_SPAWN.POWER_TARGET || 50
      : 50;
  },

  getNukerMinStorageEnergy() {
    return config.ADVANCED && config.ADVANCED.NUKER
      ? config.ADVANCED.NUKER.MIN_STORAGE_ENERGY || 150000
      : 150000;
  },

  getNukerEnergyTarget() {
    return config.ADVANCED && config.ADVANCED.NUKER
      ? config.ADVANCED.NUKER.ENERGY_TARGET || 50000
      : 50000;
  },

  getNukerGhodiumTarget() {
    return config.ADVANCED && config.ADVANCED.NUKER
      ? config.ADVANCED.NUKER.GHODIUM_TARGET || 1000
      : 1000;
  },

  getMinStorageEnergy() {
    return config.ADVANCED
      ? config.ADVANCED.HAULER_MIN_STORAGE_ENERGY || 20000
      : 20000;
  },

  getTaskLockTtl() {
    return config.ADVANCED
      ? config.ADVANCED.TASK_LOCK_TTL || 10
      : 10;
  },

  getLabReactionAmount() {
    return typeof LAB_REACTION_AMOUNT === "number" ? LAB_REACTION_AMOUNT : 5;
  },

  getEmptySummary() {
    return {
      labStatus: "inactive",
      labProduct: null,
      factoryStatus: "inactive",
      factoryProduct: null,
      powerSpawnStatus: "inactive",
      nukerStatus: "inactive",
      taskLabel: null,
    };
  },
};
