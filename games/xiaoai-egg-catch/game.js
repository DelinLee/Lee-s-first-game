/* ============================================================
   小艾抓蛋仔大作战
   - 俯视 2D：WASD / 摇杆 控制小艾，空格 / 抓捕键 抓蛋
   - 5 关递进，每关一只蛋，限时抓捕，抓到看台词
   - 绿幕 PNG 在加载时实时抠图
   ============================================================ */

// ---------- 关卡配置 ----------
// 只有 yellow 是真素材，其余先用黄蛋变色占位，画好后替换即可
const LEVELS = [
  { key: "yellow", name: "黄蛋", emoji: "🟡", tint: null,       time: 30, ai: "easy",
    intro: "热情的黄蛋在跟你招手~ 靠近它，按抓捕键抓住它！",
    clear: "黄蛋：嘿嘿，被你抓到啦！🎉" },
  { key: "pink",   name: "粉蛋", emoji: "🩷", tint: "#ff8fc8",  time: 30, ai: "shy",
    intro: "害羞的粉蛋会停下来卖萌，但你一靠近它就脸红逃跑…",
    clear: "粉蛋：呜…被发现了啦///" },
  { key: "blue",   name: "蓝蛋", emoji: "🔵", tint: "#4ea3ff",  time: 26, ai: "stubborn",
    intro: "傲娇蓝蛋哼了一声，头也不回地往反方向硬跑！",
    clear: "蓝蛋：哼，才不是故意被你抓到的呢。" },
  { key: "white",  name: "白蛋", emoji: "⚪", tint: "#f2f2f2",  time: 24, ai: "timid",
    intro: "胆小白蛋吓得到处乱窜，但被吓到时会愣住——抓住时机！",
    clear: "白蛋：啊…啊…被、被抓住了！" },
  { key: "black",  name: "黑蛋", emoji: "⚫", tint: "#3a3a3a",  time: 22, ai: "ninja",
    intro: "忍者黑蛋会瞬间消失再出现，最难抓的最终 BOSS！",
    clear: "黑蛋：可恶…你居然抓到我了。甘拜下风。" },
];

// ============================================================
//  资源加载 + 绿幕抠图
// ============================================================
const ASSETS = {
  xiaoai_idle:  "assets/xiaoai/idle_base.png",
  xiaoai_b1:    "assets/xiaoai/breathe_01.png",
  xiaoai_b2:    "assets/xiaoai/breathe_02.png",
  xiaoai_b3:    "assets/xiaoai/breathe_03.png",
  catch1:       "assets/xiaoai/catch_1.png",   // 下蹲预备
  catch2:       "assets/xiaoai/catch_2.png",   // 前倾扑出
  catch3:       "assets/xiaoai/catch_3.png",   // 捧住
  catch4:       "assets/xiaoai/catch_4.png",   // 抱蛋开心
};

// 5 色蛋仔，每只 idle + 移动 2 帧
const EGG_COLORS = ["yellow", "pink", "blue", "black", "white"];
const eggImg = {};     // eggImg[color] = { idle, m1, m2 }
const EGG_THUMB = {};  // color -> dataURL，用于图鉴/面板展示

const images = {};

function chromaKey(img) {
  // 把绿幕背景抠成透明
  const c = document.createElement("canvas");
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const ctx = c.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, c.width, c.height);
  const d = data.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    // 绿色占主导 → 透明
    if (g > 90 && g - r > 35 && g - b > 35) {
      d[i + 3] = 0;
    }
  }
  ctx.putImageData(data, 0, 0);
  return c;
}

function loadImg(src) {
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => res(chromaKey(img));
    img.onerror = () => res(null);
    img.src = src;
  });
}

async function loadAll() {
  // 小艾 + 抓捕帧
  await Promise.all(Object.keys(ASSETS).map(async k => { images[k] = await loadImg(ASSETS[k]); }));
  // 5 色蛋仔
  await Promise.all(EGG_COLORS.map(async c => {
    const [idle, m1, m2] = await Promise.all([
      loadImg(`assets/egg/${c}/idle.png`),
      loadImg(`assets/egg/${c}/move_1.png`),
      loadImg(`assets/egg/${c}/move_2.png`),
    ]);
    eggImg[c] = { idle, m1, m2 };
  }));
}

// ============================================================
//  画布 / 尺寸
// ============================================================
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
let W = 0, H = 0, DPR = 1;

function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  const r = canvas.getBoundingClientRect();
  W = r.width; H = r.height;
  canvas.width = Math.round(W * DPR);
  canvas.height = Math.round(H * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  clampEntities();
}
window.addEventListener("resize", resize);

// ============================================================
//  输入
// ============================================================
const keys = {};
addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  keys[k] = true;
  if (k === " " || k === "spacebar") { e.preventDefault(); tryCatch(); }
});
addEventListener("keyup", (e) => { keys[e.key.toLowerCase()] = false; });

// 触屏摇杆
const joy = document.getElementById("joystick");
const knob = document.getElementById("joystick-knob");
let joyVec = { x: 0, y: 0 }, joyId = null;
const JOY_R = 50;

function joyStart(e) {
  const t = e.changedTouches ? e.changedTouches[0] : e;
  joyId = e.changedTouches ? t.identifier : "mouse";
  joyMove(e);
}
function joyMove(e) {
  const touches = e.changedTouches || [e];
  let t = null;
  for (const c of touches) if ((c.identifier ?? "mouse") === joyId) t = c;
  if (!t) return;
  const r = joy.getBoundingClientRect();
  let dx = t.clientX - (r.left + r.width / 2);
  let dy = t.clientY - (r.top + r.height / 2);
  const dist = Math.hypot(dx, dy) || 1;
  const clamped = Math.min(dist, JOY_R);
  const nx = dx / dist, ny = dy / dist;
  knob.style.transform = `translate(calc(-50% + ${nx * clamped}px), calc(-50% + ${ny * clamped}px))`;
  joyVec.x = nx * (clamped / JOY_R);
  joyVec.y = ny * (clamped / JOY_R);
}
function joyEnd() {
  joyId = null; joyVec.x = 0; joyVec.y = 0;
  knob.style.transform = "translate(-50%, -50%)";
}
joy.addEventListener("touchstart", (e) => { e.preventDefault(); joyStart(e); }, { passive: false });
joy.addEventListener("touchmove", (e) => { e.preventDefault(); joyMove(e); }, { passive: false });
joy.addEventListener("touchend", (e) => { e.preventDefault(); joyEnd(); }, { passive: false });

const catchBtn = document.getElementById("catch-btn");
catchBtn.addEventListener("touchstart", (e) => { e.preventDefault(); tryCatch(); }, { passive: false });

// 检测是否触屏设备
const isTouch = ("ontouchstart" in window) || navigator.maxTouchPoints > 0;

// ============================================================
//  游戏状态 / 实体
// ============================================================
let state = "loading";   // loading | title | playing | clear | win | lose
let levelIndex = 0;
let caught = [];          // 已抓到的 key
let timeLeft = 0;
let lastT = 0;

const xiaoai = {
  x: 0, y: 0, vx: 0, vy: 0,
  speed: 230,
  facing: 1,          // 1 右, -1 左
  walkPhase: 0,       // 走路晃动相位
  moving: false,
  catchT: 0,          // 抓捕动作计时
};

const egg = {
  x: 0, y: 0, vx: 0, vy: 0,
  speed: 150,
  facing: 1,
  walkPhase: 0,
  state: "run",       // run | frozen | caught
  freezeT: 0,
  poseT: 0,           // 卖萌 / 行为计时
  blinkT: 0,
};

const CATCH_RADIUS = 78;   // 进入此距离可抓
let inRange = false;

function clampEntities() {
  const m = 60;
  for (const o of [xiaoai, egg]) {
    o.x = Math.max(m, Math.min(W - m, o.x || W / 2));
    o.y = Math.max(m + 40, Math.min(H - m, o.y || H / 2));
  }
}

// ============================================================
//  关卡流程
// ============================================================
function startLevel(i) {
  levelIndex = i;
  const lv = LEVELS[i];
  timeLeft = lv.time;
  xiaoai.x = W * 0.3; xiaoai.y = H * 0.7; xiaoai.catchT = 0;
  egg.x = W * 0.7; egg.y = H * 0.35;
  egg.state = "run"; egg.freezeT = 0; egg.poseT = 0;
  inRange = false;
  state = "playing";
  showOverlay(false);
  document.getElementById("hud").classList.remove("hidden");
  renderDex();
  document.getElementById("dex").classList.remove("hidden");
  if (isTouch) {
    joy.classList.remove("hidden");
    catchBtn.classList.remove("hidden");
  }
  updateHUD();
}

function levelClear() {
  state = "clear";
  if (!caught.includes(LEVELS[levelIndex].key)) caught.push(LEVELS[levelIndex].key);
  if (typeof Save !== "undefined") Save.addCaught(LEVELS[levelIndex].key);  // 存进农场
  renderDex();
  const lv = LEVELS[levelIndex];
  hideTouchControls();
  showPanel(`
    <h2>抓到 ${lv.name} 啦！</h2>
    <div class="big-egg">${eggIcon(lv.key, 90)}</div>
    <div class="speech">${lv.clear}</div>
    <button class="btn" id="next-btn">${levelIndex < LEVELS.length - 1 ? "下一关 →" : "看结局 ♥"}</button>
  `);
  document.getElementById("next-btn").onclick = () => {
    if (levelIndex < LEVELS.length - 1) startLevel(levelIndex + 1);
    else winGame();
  };
}

function loseLevel() {
  state = "lose";
  hideTouchControls();
  const lv = LEVELS[levelIndex];
  showPanel(`
    <h2>时间到！</h2>
    <p>${lv.name} 趁机溜走了…再试一次？</p>
    <div class="big-egg">${eggIcon(lv.key, 80)} 💨</div>
    <button class="btn" id="retry-btn">再抓一次</button>
  `);
  document.getElementById("retry-btn").onclick = () => startLevel(levelIndex);
}

function winGame() {
  state = "win";
  hideTouchControls();
  document.getElementById("hud").classList.add("hidden");
  const eggs = LEVELS.map(l => eggIcon(l.key, 56)).join(" ");
  showPanel(`
    <h1>全部抓到啦！</h1>
    <div class="big-egg">${eggs}</div>
    <a class="btn" href="farm.html">去蛋蛋农场 🌱</a>
    <button class="btn btn-ghost" id="restart-btn">再玩一次</button>
  `);
  document.getElementById("restart-btn").onclick = () => { caught = []; startLevel(0); };
}

function showTitle() {
  state = "title";
  document.getElementById("hud").classList.add("hidden");
  document.getElementById("dex").classList.add("hidden");
  hideTouchControls();
  const ctrl = isTouch
    ? `<div class="controls-tip"><span><b>左摇杆</b> 移动</span><span><b>抓!</b> 抓捕</span></div>`
    : `<div class="controls-tip"><span><b>WASD</b> 移动</span><span><b>空格</b> 抓捕</span></div>`;
  showPanel(`
    <h1>小艾抓蛋仔大作战</h1>
    <p>操控小艾，抓住 5 只性格各异的蛋仔！</p>
    <div class="big-egg">${LEVELS.map(l => eggIcon(l.key, 48)).join(" ")}</div>
    ${ctrl}
    <button class="btn" id="start-btn">开始游戏</button>
  `);
  document.getElementById("start-btn").onclick = () => { caught = []; startLevel(0); };
}

function hideTouchControls() {
  joy.classList.add("hidden");
  catchBtn.classList.add("hidden");
}

// ---------- UI helpers ----------
const overlay = document.getElementById("overlay");
const panel = document.getElementById("panel");
function showOverlay(show) { overlay.style.display = show ? "flex" : "none"; }
function showPanel(html) { panel.innerHTML = html; showOverlay(true); }

function updateHUD() {
  document.getElementById("level-name").textContent =
    `第 ${levelIndex + 1} 关 · ${LEVELS[levelIndex].name}`;
  const t = document.getElementById("timer");
  t.textContent = `⏱ ${Math.ceil(timeLeft)}`;
  t.classList.toggle("warn", timeLeft <= 5);
}

function eggIcon(key, size) {
  return EGG_THUMB[key]
    ? `<img src="${EGG_THUMB[key]}" style="height:${size}px;width:auto;vertical-align:middle;image-rendering:pixelated;">`
    : (LEVELS.find(l => l.key === key)?.emoji || "🥚");
}

function renderDex() {
  const dex = document.getElementById("dex");
  dex.innerHTML = LEVELS.map(l => {
    const got = caught.includes(l.key);
    return `<div class="dex-slot ${got ? "caught" : ""}">${got ? eggIcon(l.key, 30) : "·"}</div>`;
  }).join("");
}

// ============================================================
//  抓捕
// ============================================================
function tryCatch() {
  if (state !== "playing") return;
  if (xiaoai.catchT > 0) return;
  xiaoai.catchT = 0.45;            // 播放抓捕动作
  // 朝蛋方向小扑一下
  const dx = egg.x - xiaoai.x, dy = egg.y - xiaoai.y;
  const dist = Math.hypot(dx, dy) || 1;
  xiaoai.vx += (dx / dist) * 60;
  xiaoai.vy += (dy / dist) * 60;
  // 在扑出的瞬间判定
  setTimeout(() => {
    if (state !== "playing") return;
    const d = Math.hypot(egg.x - xiaoai.x, egg.y - xiaoai.y);
    if (d <= CATCH_RADIUS && egg.state !== "caught") {
      egg.state = "caught";
      setTimeout(levelClear, 350);
    }
  }, 150);
}

// ============================================================
//  更新
// ============================================================
function update(dt) {
  if (state !== "playing") return;

  // 计时
  timeLeft -= dt;
  updateHUD();
  if (timeLeft <= 0) { loseLevel(); return; }

  // ---- 小艾移动 ----
  let ix = 0, iy = 0;
  if (keys["w"] || keys["arrowup"]) iy -= 1;
  if (keys["s"] || keys["arrowdown"]) iy += 1;
  if (keys["a"] || keys["arrowleft"]) ix -= 1;
  if (keys["d"] || keys["arrowright"]) ix += 1;
  ix += joyVec.x; iy += joyVec.y;
  const il = Math.hypot(ix, iy);
  if (il > 1) { ix /= il; iy /= il; }

  xiaoai.moving = il > 0.05 && xiaoai.catchT <= 0;
  const sp = xiaoai.catchT > 0 ? xiaoai.speed * 0.3 : xiaoai.speed;
  xiaoai.vx += (ix * sp - xiaoai.vx) * Math.min(1, dt * 12);
  xiaoai.vy += (iy * sp - xiaoai.vy) * Math.min(1, dt * 12);
  xiaoai.x += xiaoai.vx * dt;
  xiaoai.y += xiaoai.vy * dt;
  if (Math.abs(ix) > 0.1) xiaoai.facing = ix > 0 ? 1 : -1;
  if (xiaoai.moving) xiaoai.walkPhase += dt * 11;
  if (xiaoai.catchT > 0) xiaoai.catchT -= dt;

  const m = 50;
  xiaoai.x = Math.max(m, Math.min(W - m, xiaoai.x));
  xiaoai.y = Math.max(m + 40, Math.min(H - m, xiaoai.y));

  // ---- 蛋 AI ----
  if (egg.state !== "caught") updateEgg(dt);

  // ---- 可抓范围提示 ----
  inRange = Math.hypot(egg.x - xiaoai.x, egg.y - xiaoai.y) <= CATCH_RADIUS && egg.state !== "caught";
}

function updateEgg(dt) {
  const lv = LEVELS[levelIndex];
  egg.blinkT -= dt;
  if (egg.blinkT < 0) egg.blinkT = 2 + Math.random() * 3;

  const dx = xiaoai.x - egg.x, dy = xiaoai.y - egg.y;
  const dist = Math.hypot(dx, dy) || 1;
  let ax = 0, ay = 0;       // 期望移动方向
  let speed = egg.speed;

  switch (lv.ai) {
    case "easy": {            // 黄蛋：慢悠悠，靠近才弱逃
      speed = 130;
      egg.poseT -= dt;
      if (egg.poseT <= 0) { egg.poseT = 1.2 + Math.random(); egg.wx = Math.random()*2-1; egg.wy = Math.random()*2-1; }
      ax = egg.wx; ay = egg.wy;
      if (dist < 170) { ax = -dx/dist; ay = -dy/dist; speed = 150; }
      break;
    }
    case "shy": {             // 粉蛋：定时卖萌停住，靠近就快逃
      egg.poseT -= dt;
      if (dist < 200) { ax = -dx/dist; ay = -dy/dist; speed = 230; }
      else if (egg.poseT > 0) { speed = 0; }   // 卖萌停住
      else { ax = Math.random()*2-1; ay = Math.random()*2-1; speed = 120;
             if (Math.random() < dt*0.6) egg.poseT = 0.8; }
      break;
    }
    case "stubborn": {        // 蓝蛋：远远就往反方向硬跑，速度快
      speed = 250;
      ax = -dx/dist; ay = -dy/dist;
      break;
    }
    case "timid": {           // 白蛋：乱窜，太近时吓到愣住
      egg.poseT -= dt;
      if (dist < 120 && egg.freezeT <= 0 && Math.random() < dt*2.5) egg.freezeT = 0.7;
      if (egg.freezeT > 0) { egg.freezeT -= dt; speed = 0; }
      else {
        speed = 270;
        if (egg.poseT <= 0) { egg.poseT = 0.4+Math.random()*0.4; egg.wx=Math.random()*2-1; egg.wy=Math.random()*2-1; }
        ax = egg.wx*0.5 - dx/dist; ay = egg.wy*0.5 - dy/dist;
      }
      break;
    }
    case "ninja": {           // 黑蛋：靠近会瞬移
      speed = 210;
      ax = -dx/dist; ay = -dy/dist;
      egg.poseT -= dt;
      if (dist < 150 && egg.poseT <= 0) {
        egg.x = 60 + Math.random()*(W-120);
        egg.y = 100 + Math.random()*(H-160);
        egg.poseT = 1.4;       // 瞬移冷却
        egg.teleFx = 0.3;
      }
      break;
    }
  }

  const al = Math.hypot(ax, ay);
  if (al > 0.01) { ax/=al; ay/=al; }
  egg.vx += (ax*speed - egg.vx) * Math.min(1, dt*8);
  egg.vy += (ay*speed - egg.vy) * Math.min(1, dt*8);
  egg.x += egg.vx*dt; egg.y += egg.vy*dt;
  if (Math.abs(egg.vx) > 5) egg.facing = egg.vx > 0 ? 1 : -1;
  egg.walkPhase += dt * 12 * (Math.hypot(egg.vx,egg.vy) > 20 ? 1 : 0);
  if (egg.teleFx > 0) egg.teleFx -= dt;

  // 边界反弹
  const bm = 50;
  if (egg.x < bm) { egg.x = bm; egg.vx = Math.abs(egg.vx); }
  if (egg.x > W-bm) { egg.x = W-bm; egg.vx = -Math.abs(egg.vx); }
  if (egg.y < bm+40) { egg.y = bm+40; egg.vy = Math.abs(egg.vy); }
  if (egg.y > H-bm) { egg.y = H-bm; egg.vy = -Math.abs(egg.vy); }
}

// ============================================================
//  渲染
// ============================================================
function drawShadow(x, y, w) {
  ctx.save();
  ctx.fillStyle = "rgba(80,50,20,0.18)";
  ctx.beginPath();
  ctx.ellipse(x, y, w*0.5, w*0.18, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.restore();
}

function drawSprite(canv, x, y, h, facing, opts={}) {
  if (!canv) return;
  const ratio = canv.width / canv.height;
  const dh = h, dw = h * ratio;
  ctx.save();
  ctx.translate(x, y);
  if (opts.rot) ctx.rotate(opts.rot);
  ctx.scale(facing, 1);
  if (opts.squashY) ctx.scale(1, opts.squashY);
  ctx.globalAlpha = opts.alpha ?? 1;
  ctx.imageSmoothingEnabled = false;
  // y 为脚底基准
  ctx.drawImage(canv, -dw/2, -dh, dw, dh);
  ctx.restore();
}

function render() {
  ctx.clearRect(0, 0, W, H);
  drawGround();

  if (state === "playing" || state === "clear" || state === "lose") {
    // 可抓范围提示圈
    if (inRange) {
      ctx.save();
      ctx.strokeStyle = "rgba(255,180,40,0.9)";
      ctx.lineWidth = 4; ctx.setLineDash([10, 8]);
      ctx.lineDashOffset = -performance.now()/40;
      ctx.beginPath();
      ctx.ellipse(egg.x, egg.y, CATCH_RADIUS*0.7, CATCH_RADIUS*0.3, 0, 0, Math.PI*2);
      ctx.stroke();
      ctx.restore();
    }

    // 按 y 排序绘制
    const ents = [];
    // 蛋
    if (egg.state !== "caught") {
      ents.push({ y: egg.y, draw: drawEgg });
    }
    // 小艾
    ents.push({ y: xiaoai.y, draw: drawXiaoai });
    ents.sort((a,b) => a.y - b.y);
    for (const e of ents) e.draw();
  }
}

function drawGround() {
  // 简单装饰：草地圆点
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = "#f6c97a";
  const step = 90;
  for (let gx = 40; gx < W; gx += step)
    for (let gy = 70; gy < H; gy += step) {
      ctx.beginPath(); ctx.arc(gx + (gy/step%2?45:0), gy, 4, 0, Math.PI*2); ctx.fill();
    }
  ctx.restore();
}

const CATCH_DUR = 0.45;
function drawXiaoai() {
  const bob = xiaoai.moving ? Math.abs(Math.sin(xiaoai.walkPhase)) * 8 : Math.sin(performance.now()/600)*2;
  const lean = xiaoai.moving ? Math.sin(xiaoai.walkPhase) * 0.06 : 0;
  drawShadow(xiaoai.x, xiaoai.y, 70);

  if (xiaoai.catchT > 0) {
    // 4 帧抓捕动画：预备→扑出→捧住→抱蛋
    const p = 1 - xiaoai.catchT / CATCH_DUR;     // 0→1
    const fi = Math.min(3, Math.floor(p * 4));
    const img = [images.catch1, images.catch2, images.catch3, images.catch4][fi];
    drawSprite(img, xiaoai.x, xiaoai.y, 150, xiaoai.facing, {});
    return;
  }

  let img = images.xiaoai_idle;
  let rot = lean * xiaoai.facing;
  if (xiaoai.moving) {
    const f = Math.floor(xiaoai.walkPhase) % 3;
    img = [images.xiaoai_b1, images.xiaoai_b2, images.xiaoai_b3][f] || images.xiaoai_idle;
  }
  drawSprite(img, xiaoai.x, xiaoai.y - bob, 150, xiaoai.facing, { rot });
}

function drawEgg() {
  const lv = LEVELS[levelIndex];
  const set = eggImg[lv.key] || {};
  const moving = Math.hypot(egg.vx, egg.vy) > 20;
  const bob = moving ? Math.abs(Math.sin(egg.walkPhase)) * 7 : Math.sin(performance.now()/500)*2;
  const squash = moving ? 1 + Math.sin(egg.walkPhase*2)*0.05 : 1;
  drawShadow(egg.x, egg.y, 56);
  let img = set.idle;
  if (moving) img = (Math.floor(egg.walkPhase) % 2 ? set.m1 : set.m2) || set.idle;
  const alpha = egg.teleFx > 0 ? 0.4 : 1;
  drawSprite(img, egg.x, egg.y - bob, 96, egg.facing, { squashY: squash, alpha });
}

// ============================================================
//  主循环
// ============================================================
function loop(t) {
  const dt = Math.min((t - lastT) / 1000 || 0, 0.05);
  lastT = t;
  update(dt);
  render();
  requestAnimationFrame(loop);
}

// ============================================================
//  启动
// ============================================================
(async function init() {
  resize();
  showPanel(`<h1>加载中…</h1><div class="big-egg">🥚</div>`);
  showOverlay(true);
  await loadAll();
  for (const c of EGG_COLORS) if (eggImg[c] && eggImg[c].idle) EGG_THUMB[c] = eggImg[c].idle.toDataURL();
  resize();
  showTitle();
  requestAnimationFrame(loop);
})();
