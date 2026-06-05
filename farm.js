/* ============================================================
   蛋蛋农场 —— 抓到的蛋仔在这里开心地蹦蹦跳跳
   读取存档(Save)，每只抓到的蛋生成一个会蹦跳漫步的精灵(DOM)。
   ============================================================ */
const CAP_PER_COLOR = 6;   // 同色最多显示几只（防止刷屏）
const field = document.getElementById("field");

const caughtMap = Save.caughtMap();
const colors = Save.COLORS.filter(c => (caughtMap[c] || 0) > 0);
const total = Save.totalCount();

// 计数 / 空状态
document.getElementById("count-chip").textContent = `${total} 只蛋仔`;
if (colors.length === 0) {
  document.getElementById("empty").classList.remove("hidden");
}

let W = window.innerWidth, H = window.innerHeight;
window.addEventListener("resize", () => { W = window.innerWidth; H = window.innerHeight; });

// 活动区域：屏幕下半部分（留出顶栏）
function bandTop() { return H * 0.42; }
function bandBottom() { return H * 0.86; }

const GRAV = 1600;       // 跳跃重力
const eggs = [];

function depthScale(gy) {
  const t = (gy - bandTop()) / (bandBottom() - bandTop());  // 0(远)→1(近)
  return 0.78 + t * 0.42;
}

function spawnEgg(color) {
  const wrap = document.createElement("div");
  wrap.className = "farm-egg";
  const img = document.createElement("img");
  img.src = `assets/egg/${color}/idle.png`;
  img.style.height = "78px";
  img.style.display = "block";
  const shadow = document.createElement("div");
  shadow.className = "shadow";
  wrap.appendChild(shadow);
  wrap.appendChild(img);
  field.appendChild(wrap);

  const gy = bandTop() + Math.random() * (bandBottom() - bandTop());
  const e = {
    wrap, img, color,
    idleSrc: `assets/egg/${color}/idle.png`,
    moveSrc: `assets/egg/${color}/move_1.png`,
    moving: false,
    x: 40 + Math.random() * (W - 80),
    gy,
    vx: (Math.random() < 0.5 ? -1 : 1) * (30 + Math.random() * 40),
    vy: (Math.random() * 2 - 1) * 18,
    h: 0, hv: 0,
    hopCd: 0.5 + Math.random() * 2.5,
    facing: 1,
    squash: 1,
  };
  eggs.push(e);
  return e;
}

// 生成蛋（按抓到次数，单色封顶）
let spawned = 0;
for (const c of colors) {
  const n = Math.min(caughtMap[c], CAP_PER_COLOR);
  for (let i = 0; i < n; i++) spawnEgg(c);
  // 超出封顶的用角标提示
  if (caughtMap[c] > CAP_PER_COLOR && eggs.length) {
    const last = eggs[eggs.length - 1];
    const b = document.createElement("div");
    b.className = "badge";
    b.textContent = "x" + caughtMap[c];
    last.wrap.appendChild(b);
  }
}

function update(dt) {
  const pad = 36;
  for (const e of eggs) {
    // 水平漫步
    e.x += e.vx * dt;
    if (e.x < pad) { e.x = pad; e.vx = Math.abs(e.vx); }
    if (e.x > W - pad) { e.x = W - pad; e.vx = -Math.abs(e.vx); }
    e.facing = e.vx >= 0 ? 1 : -1;

    // 纵向（深度）轻微游走
    e.gy += e.vy * dt;
    if (e.gy < bandTop()) { e.gy = bandTop(); e.vy = Math.abs(e.vy); }
    if (e.gy > bandBottom()) { e.gy = bandBottom(); e.vy = -Math.abs(e.vy); }

    // 蹦跳
    e.hopCd -= dt;
    if (e.h <= 0 && e.hopCd <= 0) {
      e.hv = 360 + Math.random() * 220;     // 起跳
      e.hopCd = 1.2 + Math.random() * 2.8;
      // 偶尔换个方向 / 速度
      if (Math.random() < 0.5) e.vx = (Math.random() < 0.5 ? -1 : 1) * (25 + Math.random() * 55);
    }
    if (e.hv > 0 || e.h > 0) {
      e.hv -= GRAV * dt;
      e.h += e.hv * dt;
      if (e.h < 0) { e.h = 0; e.hv = 0; e.squash = 0.78; }  // 落地压扁
    }
    e.moving = e.h > 2;
    // 落地回弹
    e.squash += (1 - e.squash) * Math.min(1, dt * 12);

    // 图像：腾空用走路帧
    const want = e.moving ? e.moveSrc : e.idleSrc;
    if (e.img.getAttribute("src") !== want) e.img.setAttribute("src", want);

    // 渲染
    const sc = depthScale(e.gy);
    const sy = sc * e.squash;
    const sx = sc * e.facing * (2 - e.squash);   // 压扁时横向略胖
    e.wrap.style.transform =
      `translate(${e.x}px, ${e.gy - e.h}px) translate(-50%, -100%) scale(${sx}, ${sy})`;
    e.wrap.style.zIndex = Math.round(e.gy);
  }
}

update(0.0001);   // 立即摆好初始位置，避免首帧前堆在角落

let last = performance.now();
function loop(t) {
  const dt = Math.min((t - last) / 1000 || 0, 0.05);
  last = t;
  update(dt);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
