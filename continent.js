/* ============================================================
   Lee 的梦想大陆 —— 主页面交互（分层 + 逐像素命中）
   鼠标真正压在某建筑的不透明像素上，那一层才放大发光；点击触发行为。
   想改内容/锚点：调 REGIONS 即可。
   ============================================================ */
const REGIONS = {
  // z 顺序从下到上，靠后的优先命中（与视觉叠放一致）
  mountain: { name: "⛰️ 高山", emoji: "⛰️", origin: "71% 38%",
    desc: "高耸入云的雪山，山顶的风景留给以后的你去发现。" },
  forest:   { name: "🌲 森林", emoji: "🌲", origin: "16% 43%",
    desc: "幽深的森林里似乎藏着什么……新玩法很快会长出来。" },
  town:     { name: "🏘️ 小镇", emoji: "🏘️", origin: "80% 63%",
    desc: "热闹的小镇正在建设中，以后这里会有更多有趣的内容。" },
  farm:     { name: "🥚 艾格农场 · 点击进入", emoji: "🥚", origin: "48% 72%",
    live: true, href: "games/xiaoai-egg-catch/" },
  harbor:   { name: "⚓ 港口", emoji: "⚓", origin: "14% 77%",
    desc: "小船停靠的港口，未来也许会有出海的冒险。敬请期待～" },
};
const ORDER = ["mountain", "forest", "town", "farm", "harbor"]; // 命中优先级：后者覆盖前者

const map = document.getElementById("map");
const tip = document.getElementById("tip");

// 设置各层放大锚点
ORDER.forEach((k) => {
  const l = document.querySelector(`.blayer[data-key="${k}"]`);
  if (l) l.style.transformOrigin = REGIONS[k].origin;
});
function layerOf(k) { return document.querySelector(`.blayer[data-key="${k}"]`); }

// ---------- 构建命中 ID 图（缩小分辨率，读各层 alpha）----------
const SW = 418, SH = 235;        // id 图分辨率（约 1/4）
let idmap = null;                 // Uint8Array，存区域序号(1..N)，0=无
function buildIdMap() {
  const cv = document.createElement("canvas");
  cv.width = SW; cv.height = SH;
  const c = cv.getContext("2d", { willReadFrequently: true });
  idmap = new Uint8Array(SW * SH);
  ORDER.forEach((key, gi) => {
    const layer = layerOf(key);
    if (!layer || layer.classList.contains("missing") || !layer.complete || !layer.naturalWidth) return;
    c.clearRect(0, 0, SW, SH);
    c.drawImage(layer, 0, 0, SW, SH);
    const d = c.getImageData(0, 0, SW, SH).data;
    for (let p = 0; p < SW * SH; p++) {
      if (d[p * 4 + 3] > 40) idmap[p] = gi + 1;  // 后画的覆盖先画的
    }
  });
}

function keyAt(clientX, clientY) {
  if (!idmap) return null;
  const r = map.getBoundingClientRect();
  const fx = (clientX - r.left) / r.width, fy = (clientY - r.top) / r.height;
  if (fx < 0 || fx > 1 || fy < 0 || fy > 1) return null;
  const ix = Math.min(SW - 1, Math.floor(fx * SW));
  const iy = Math.min(SH - 1, Math.floor(fy * SH));
  const v = idmap[iy * SW + ix];
  return v ? ORDER[v - 1] : null;
}

// ---------- 悬停高亮 ----------
let current = null;
function setHover(key) {
  if (key === current) return;
  if (current) layerOf(current)?.classList.remove("hi");
  current = key;
  if (key) {
    layerOf(key)?.classList.add("hi");
    tip.textContent = REGIONS[key].name;
    tip.classList.toggle("live", !!REGIONS[key].live);
    tip.hidden = false;
    map.classList.add("pointing");
  } else {
    tip.hidden = true;
    map.classList.remove("pointing");
  }
}

map.addEventListener("mousemove", (e) => {
  const key = keyAt(e.clientX, e.clientY);
  setHover(key);
  if (key) {
    const r = map.getBoundingClientRect();
    tip.style.left = (e.clientX - r.left) + "px";
    tip.style.top = (e.clientY - r.top) + "px";
  }
});
map.addEventListener("mouseleave", () => setHover(null));

map.addEventListener("click", (e) => {
  const key = keyAt(e.clientX, e.clientY);
  if (key) trigger(key);
});

// 触屏：第一次点亮，再点确认（或直接触发）
map.addEventListener("touchstart", (e) => {
  const t = e.changedTouches[0];
  const key = keyAt(t.clientX, t.clientY);
  if (!key) { setHover(null); return; }
  e.preventDefault();
  if (key === current) { trigger(key); }
  else {
    setHover(key);
    const r = map.getBoundingClientRect();
    tip.style.left = (t.clientX - r.left) + "px";
    tip.style.top = (t.clientY - r.top) + "px";
  }
}, { passive: false });

function trigger(key) {
  const r = REGIONS[key];
  if (r.href) window.location.href = r.href;
  else openModal(r);
}

// ---------- 敬请期待 弹窗 ----------
const modal = document.getElementById("modal");
const modalEmoji = document.getElementById("modal-emoji");
const modalTitle = document.getElementById("modal-title");
const modalDesc = document.getElementById("modal-desc");
function openModal(r) {
  modalEmoji.textContent = r.emoji || "🚧";
  modalTitle.textContent = `${r.name.replace(/^\S+\s/, "")} · 敬请期待`;
  modalDesc.textContent = r.desc || "这片土地还在发芽，新的玩法很快会长出来。";
  modal.hidden = false;
}
function closeModal() { modal.hidden = true; }
document.getElementById("modal-close").addEventListener("click", closeModal);
modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

// ---------- 等图层加载完再建 ID 图 ----------
function whenLayersReady(cb) {
  const layers = ORDER.map(layerOf).filter(Boolean);
  let n = 0;
  const done = () => { if (++n >= layers.length) cb(); };
  layers.forEach((l) => {
    if (l.complete) done();
    else { l.addEventListener("load", done); l.addEventListener("error", done); }
  });
  if (layers.length === 0) cb();
}
whenLayersReady(buildIdMap);
window.addEventListener("resize", () => { /* idmap 用相对坐标，无需重建 */ });
