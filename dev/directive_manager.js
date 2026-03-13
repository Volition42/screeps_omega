const config = require("config");

module.exports = {
  run(room, state) {
    if (!config.DIRECTIVES.ENABLED) return;
    if (Game.time % config.DIRECTIVES.INTERVAL !== 0) return;

    const lines = this.getDirectiveLines(room, state);

    for (const line of lines) {
      console.log(line);
    }
  },

  getDirectiveLines(room, state) {
    const roomName = room.name;
    const controllerLevel = room.controller ? room.controller.level : 0;
    const hostiles = state.hostileCreeps ? state.hostileCreeps.length : 0;
    const constructionSites = state.sites ? state.sites.length : 0;
    const sourceContainers = state.sourceContainers
      ? state.sourceContainers.length
      : 0;
    const controllerContainers = state.controllerContainers
      ? state.controllerContainers.length
      : 0;
    const energyLine = `${room.energyAvailable}/${room.energyCapacityAvailable}`;

    const header = `[vCORP Directive Update] [Sector:${roomName}]`;
    const footer = `[vCORP Status] phase=${state.phase} rcl=${controllerLevel} energy=${energyLine}`;

    if (hostiles > 0) {
      return [
        header,
        "Security escalation authorized.",
        `Hostile workforce detected: ${hostiles}.`,
        "Defensive assets are to prioritize threat suppression and continuity of operations.",
        footer,
      ];
    }

    if (state.phase === "bootstrap_jr") {
      return [
        header,
        "Early market entry protocol active.",
        "Junior labor assets are conducting direct extraction and controller investment.",
        "Short-term growth is prioritized over operational elegance.",
        footer,
      ];
    }

    if (state.phase === "bootstrap") {
      return [
        header,
        "Infrastructure seeding program initiated.",
        `Source container coverage: ${sourceContainers}/${state.sources.length}.`,
        `Controller container coverage: ${controllerContainers}/1.`,
        "Foundational logistics are being positioned for scalable growth.",
        footer,
      ];
    }

    if (state.phase === "developing") {
      if (constructionSites > 0) {
        return [
          header,
          "Market Expansion Program initiated.",
          `Active construction packages: ${constructionSites}.`,
          "Resource acquisition priority increased to support structured development.",
          footer,
        ];
      }

      return [
        header,
        "Regional development remains on schedule.",
        "Infrastructure deployment has entered an efficiency optimization cycle.",
        "Energy flow is being redirected toward strategic growth targets.",
        footer,
      ];
    }

    if (state.phase === "stable") {
      return [
        header,
        "Operational stability confirmed.",
        "Core infrastructure is performing within acceptable corporate tolerances.",
        "Excess capacity may be redirected toward expansion, fortification, or revenue extraction.",
        footer,
      ];
    }

    return [
      header,
      "Administrative review in progress.",
      "No special directive was generated for this cycle.",
      footer,
    ];
  },
};
