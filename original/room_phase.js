module.exports = {
  get(room) {
    const controllerLevel = room.controller ? room.controller.level : 0;
    const containers = room.find(FIND_STRUCTURES, {
      filter: (s) => s.structureType === STRUCTURE_CONTAINER,
    });
    const towers = room.find(FIND_MY_STRUCTURES, {
      filter: (s) => s.structureType === STRUCTURE_TOWER,
    });

    if (containers.length < 2) return "bootstrap";
    if (controllerLevel < 3 || towers.length === 0) return "developing";
    return "stabilized";
  },
};
