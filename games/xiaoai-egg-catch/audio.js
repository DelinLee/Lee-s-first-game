/* ============================================================
   音效系统（纯 WebAudio 合成，无需音频文件）
   - sfx.catch/clear/lose/click/hop/step 等短音效
   - BGM：轻快循环旋律，可开关
   - 静音状态存 localStorage；浏览器策略要求首次交互后才出声
   ============================================================ */
const Audio2 = (() => {
  let ctx = null;
  let master = null;
  let bgmGain = null;
  let bgmTimer = null;
  let muted = localStorage.getItem("eggcatch_mute") === "1";

  function ensure() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 1;
      master.connect(ctx.destination);
      bgmGain = ctx.createGain();
      bgmGain.gain.value = 0.18;
      bgmGain.connect(master);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  // 单音
  function tone(freq, dur, t0, type = "sine", vol = 0.3, dest = null) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(dest || master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  // 音阶 (C 大调五声)
  const SC = { C: 261.63, D: 293.66, E: 329.63, G: 392.0, A: 440.0, C2: 523.25, D2: 587.33, E2: 659.25, G2: 783.99 };

  const sfx = {
    click() { ensure(); const t = ctx.currentTime; tone(660, 0.08, t, "triangle", 0.25); },
    catch() {  // 上行小琶音 + 叮
      ensure(); const t = ctx.currentTime;
      [SC.C2, SC.E2, SC.G2].forEach((f, i) => tone(f, 0.18, t + i * 0.06, "triangle", 0.3));
      tone(SC.G2 * 2, 0.25, t + 0.18, "sine", 0.18);
    },
    clear() {  // 过关小旋律
      ensure(); const t = ctx.currentTime;
      [SC.C2, SC.D2, SC.E2, SC.G2].forEach((f, i) => tone(f, 0.22, t + i * 0.1, "triangle", 0.3));
    },
    win() {    // 通关欢呼
      ensure(); const t = ctx.currentTime;
      [SC.C2, SC.E2, SC.G2, SC.C2 * 2, SC.G2, SC.C2 * 2].forEach((f, i) => tone(f, 0.3, t + i * 0.12, "triangle", 0.32));
    },
    lose() {   // 下行失落
      ensure(); const t = ctx.currentTime;
      [SC.G, SC.E, SC.C].forEach((f, i) => tone(f, 0.25, t + i * 0.12, "sawtooth", 0.18));
    },
    hop() { ensure(); const t = ctx.currentTime; tone(520, 0.09, t, "sine", 0.16); },
    pop() { ensure(); const t = ctx.currentTime; tone(880, 0.07, t, "square", 0.14); tone(1320, 0.06, t + 0.03, "sine", 0.1); },
  };

  // ---- BGM：轻快循环（五声音阶随机走动 + 低音）----
  const MELODY = [SC.C2, SC.E2, SC.G2, SC.E2, SC.D2, SC.G2, SC.A * 2 || SC.A, SC.G2,
                  SC.E2, SC.C2, SC.D2, SC.E2, SC.G2, SC.E2, SC.D2, SC.C2];
  const BASS = [SC.C, SC.G, SC.A, SC.E];
  let step = 0;
  const BEAT = 0.32;

  function scheduleBar() {
    if (!ctx) return;
    const t = ctx.currentTime + 0.05;
    for (let i = 0; i < 4; i++) {
      const m = MELODY[(step + i) % MELODY.length];
      tone(m, 0.26, t + i * BEAT, "triangle", 0.12, bgmGain);
      if (i % 2 === 0) tone(BASS[(step / 2 + i) % BASS.length] / 2, 0.5, t + i * BEAT, "sine", 0.1, bgmGain);
    }
    step = (step + 4) % MELODY.length;
  }

  const bgm = {
    playing: false,
    start() {
      ensure();
      if (this.playing) return;
      this.playing = true;
      scheduleBar();
      bgmTimer = setInterval(scheduleBar, BEAT * 1000 * 4);
    },
    stop() {
      this.playing = false;
      if (bgmTimer) { clearInterval(bgmTimer); bgmTimer = null; }
    },
  };

  function setMuted(m) {
    muted = m;
    localStorage.setItem("eggcatch_mute", m ? "1" : "0");
    if (master) master.gain.value = m ? 0 : 1;
  }
  function isMuted() { return muted; }
  function toggle() { setMuted(!muted); return muted; }

  // 首次任意交互时解锁音频
  function unlockOnce() {
    const h = () => { ensure(); window.removeEventListener("pointerdown", h); window.removeEventListener("keydown", h); };
    window.addEventListener("pointerdown", h);
    window.addEventListener("keydown", h);
  }
  unlockOnce();

  // 注入一个静音按钮（右上角）
  function mountToggleButton() {
    const b = document.createElement("button");
    b.id = "sound-toggle";
    b.textContent = muted ? "🔇" : "🔊";
    b.title = "音效开关";
    b.onclick = () => { ensure(); const m = toggle(); b.textContent = m ? "🔇" : "🔊"; };
    document.body.appendChild(b);
  }

  return { sfx, bgm, setMuted, isMuted, toggle, ensure, mountToggleButton };
})();
window.Audio2 = Audio2;   // 暴露到 window，供各页面 window.Audio2 守卫使用
