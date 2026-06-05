/* ============================================================
   存档系统（localStorage）—— 记录玩家抓到了哪些蛋仔
   游戏页写入，农场页/开始页读取。
   数据结构: { caught: { yellow: 次数, pink: 次数, ... } }
   ============================================================ */
const Save = {
  KEY: "eggcatch_save_v1",
  COLORS: ["yellow", "pink", "blue", "black", "white"],

  load() {
    try {
      const d = JSON.parse(localStorage.getItem(this.KEY));
      if (d && d.caught) return d;
    } catch (e) {}
    return { caught: {} };
  },

  _save(d) {
    try { localStorage.setItem(this.KEY, JSON.stringify(d)); } catch (e) {}
  },

  // 抓到一只蛋（次数 +1）
  addCaught(color) {
    const d = this.load();
    d.caught[color] = (d.caught[color] || 0) + 1;
    this._save(d);
    return d;
  },

  caughtMap() { return this.load().caught; },

  // 抓到过的蛋种类（去重）
  caughtColors() {
    const c = this.load().caught;
    return this.COLORS.filter(k => (c[k] || 0) > 0);
  },

  has(color) { return (this.load().caught[color] || 0) > 0; },
  uniqueCount() { return this.caughtColors().length; },
  totalCount() {
    const c = this.load().caught;
    return this.COLORS.reduce((s, k) => s + (c[k] || 0), 0);
  },

  reset() { this._save({ caught: {} }); },
};
