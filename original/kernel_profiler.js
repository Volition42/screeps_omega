module.exports = {
  create() {
    return {
      sections: {},
      order: [],
      startedAt: Game.cpu.getUsed(),

      start(label) {
        if (!this.sections[label]) {
          this.sections[label] = {
            total: 0,
            start: null,
            calls: 0,
          };
          this.order.push(label);
        }

        this.sections[label].start = Game.cpu.getUsed();
      },

      end(label) {
        const section = this.sections[label];
        if (!section || section.start === null) return;

        const used = Game.cpu.getUsed() - section.start;
        section.total += used;
        section.calls += 1;
        section.start = null;
      },

      wrap(label, fn, context, ...args) {
        this.start(label);
        let result;

        try {
          result = fn.apply(context, args);
        } finally {
          this.end(label);
        }

        return result;
      },

      finalize() {
        const totalCpu = Game.cpu.getUsed();
        const tickCost = totalCpu - this.startedAt;

        return {
          tick: Game.time,
          cpu: {
            used: totalCpu,
            tickCost,
            limit: Game.cpu.limit,
            tickLimit: Game.cpu.tickLimit,
            bucket: Game.cpu.bucket,
          },
          sections: this.serializeSections(),
        };
      },

      serializeSections() {
        const result = {};

        for (const label of this.order) {
          const section = this.sections[label];
          result[label] = {
            total: Number(section.total.toFixed(3)),
            calls: section.calls,
            avg:
              section.calls > 0
                ? Number((section.total / section.calls).toFixed(3))
                : 0,
          };
        }

        return result;
      },
    };
  },
};
