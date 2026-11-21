// 첫 화면 데모: "프롬프트만으로 만들기" — 대상별 4가지 프로젝트가 프롬프트 v1→v3로 자라는 모습
(function () {
  'use strict';
  const root = document.getElementById('pm-demo');
  if (!root) return;
  const cv = root.querySelector('canvas');
  const ctx = cv.getContext('2d');
  const promptList = root.querySelector('[data-prompts]');
  const verEl = root.querySelector('[data-ver]');
  const stepEls = [...root.querySelectorAll('[data-step]')];
  const tabs = [...root.querySelectorAll('[data-track]')];
  const hintEl = root.querySelector('[data-hint]');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FONT = '-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
  const C = { ink: '#0B1220', panel: '#111a2e', line: 'rgba(255,255,255,.10)', dim: 'rgba(255,255,255,.55)', text: '#EAF1FF', yellow: '#FFC93C', blue: '#3B82F6', sky: '#7DB4FF', mint: '#5EE6A8', pink: '#FF7AB6', red: '#FF6B6B' };

  let W = 0, H = 0;
  function resize() {
    const r = cv.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    W = Math.max(200, r.width); H = Math.max(150, r.height);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    tracks.forEach(t => t.resize && t.resize());
  }
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = p => 1 - Math.pow(1 - clamp(p, 0, 1), 3);
  function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); }
  function text(s, x, y, size, color, weight = 600, align = 'left') { ctx.font = `${weight} ${size}px ${FONT}`; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(s, x, y); }
  function star(x, y, r, color, glow) {
    ctx.save(); if (glow) { ctx.shadowColor = color; ctx.shadowBlur = glow; }
    ctx.fillStyle = color; ctx.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); }
    ctx.closePath(); ctx.fill(); ctx.restore();
  }

  // ───────────── 초등: 아케이드 게임 ─────────────
  const game = {
    id: 'game', prompts: ['우주 토끼가 떨어지는 별을 받는 게임 만들어 줘', '황금 별은 +30점, 운석에 닿으면 목숨 -1', '배경은 움직이는 밤하늘, 점수 오를 때 반짝이게'],
    hint: '마우스나 손가락으로 우주선을 움직여 보세요',
    reset() { this.items = []; this.parts = []; this.pops = []; this.score = 0; this.lives = 3; this.spawn = 0; this.hurt = 0; this.ship = { x: W / 2 }; this.bg = Array.from({ length: 60 }, () => ({ x: Math.random(), y: Math.random(), z: rnd(0.2, 1) })); },
    update(dt, v) {
      const s = this; s.spawn -= dt;
      if (s.spawn <= 0) {
        s.spawn = v >= 2 ? 0.42 : 0.6;
        const r = Math.random();
        const kind = v >= 2 && r < 0.22 ? 'rock' : v >= 2 && r < 0.36 ? 'gold' : 'star';
        s.items.push({ kind, x: rnd(24, W - 24), y: -16, vy: rnd(70, 110) * (H / 230) * (v >= 3 ? 1.15 : 1), rot: rnd(0, 6) });
      }
      const sy = H - 26;
      let tx;
      if (pointer.active && performance.now() - pointer.t < 2500) tx = pointer.x;
      else {
        const want = s.items.filter(i => i.kind !== 'rock' && i.y < sy).sort((a, b) => b.y - a.y)[0];
        tx = want ? want.x : W / 2;
        const danger = s.items.find(i => i.kind === 'rock' && i.y > sy - 90 && Math.abs(i.x - s.ship.x) < 34);
        if (danger) tx = s.ship.x + (s.ship.x < danger.x ? -60 : 60);
      }
      s.ship.x += clamp(tx - s.ship.x, -380 * dt, 380 * dt); s.ship.x = clamp(s.ship.x, 18, W - 18);
      for (const it of s.items) {
        it.y += it.vy * dt; it.rot += dt * 2;
        if (!it.dead && Math.abs(it.y - sy) < 18 && Math.abs(it.x - s.ship.x) < 24) {
          it.dead = true;
          if (it.kind === 'rock') { s.lives--; s.hurt = 0.35; burst(s, it.x, it.y, '#A8A29E', 10); if (s.lives <= 0) { s.lives = 3; s.score = 0; } }
          else { const p = it.kind === 'gold' ? 30 : 10; s.score += p; if (v >= 3) { s.pops.push({ x: it.x, y: it.y - 10, t: 0, s: '+' + p, c: it.kind === 'gold' ? C.yellow : C.sky }); burst(s, it.x, it.y, it.kind === 'gold' ? C.yellow : C.sky, 14); } }
        }
      }
      s.items = s.items.filter(i => !i.dead && i.y < H + 20);
      s.parts.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 120 * dt; p.t += dt; }); s.parts = s.parts.filter(p => p.t < 0.6);
      s.pops.forEach(p => { p.t += dt; p.y -= 30 * dt; }); s.pops = s.pops.filter(p => p.t < 0.8);
      s.hurt = Math.max(0, s.hurt - dt);
      if (v >= 3) s.bg.forEach(b => { b.y += b.z * 0.05 * dt; if (b.y > 1) { b.y = 0; b.x = Math.random(); } });
    },
    draw(v, t) {
      const s = this;
      if (v >= 3) {
        const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0a0f2c'); g.addColorStop(1, '#1b1145'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        const n = ctx.createRadialGradient(W * 0.75, H * 0.3, 10, W * 0.75, H * 0.3, W * 0.5); n.addColorStop(0, 'rgba(255,122,182,.18)'); n.addColorStop(1, 'rgba(255,122,182,0)'); ctx.fillStyle = n; ctx.fillRect(0, 0, W, H);
        s.bg.forEach(b => { ctx.fillStyle = `rgba(255,255,255,${0.25 + b.z * 0.6})`; ctx.fillRect(b.x * W, b.y * H, b.z * 2, b.z * 2); });
      } else { ctx.fillStyle = C.panel; ctx.fillRect(0, 0, W, H); s.bg.slice(0, 25).forEach(b => { ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(b.x * W, b.y * H, 1.5, 1.5); }); }
      for (const it of s.items) {
        if (it.kind === 'star') star(it.x, it.y, 9, C.sky, v >= 3 ? 12 : 0);
        else if (it.kind === 'gold') star(it.x, it.y, 12, C.yellow, v >= 3 ? 18 : 0);
        else {
          if (v >= 3) { ctx.strokeStyle = 'rgba(255,160,90,.35)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(it.x, it.y - 6); ctx.lineTo(it.x, it.y - 26); ctx.stroke(); }
          ctx.fillStyle = '#8B7E74'; ctx.beginPath(); ctx.arc(it.x, it.y, 11, 0, 7); ctx.fill();
          ctx.fillStyle = '#6B5F57'; ctx.beginPath(); ctx.arc(it.x - 3, it.y - 2, 3, 0, 7); ctx.arc(it.x + 4, it.y + 3, 2, 0, 7); ctx.fill();
        }
      }
      s.parts.forEach(p => { ctx.globalAlpha = 1 - p.t / 0.6; ctx.fillStyle = p.c; ctx.fillRect(p.x, p.y, 3, 3); }); ctx.globalAlpha = 1;
      // 우주선(토끼 귀)
      const x = s.ship.x, y = H - 26;
      ctx.save(); if (v >= 3) { ctx.shadowColor = C.yellow; ctx.shadowBlur = 16; }
      if (s.hurt > 0 && Math.floor(t * 20) % 2) ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#F8FAFC'; rr(x - 9, y - 26, 5, 14, 3); ctx.fill(); rr(x + 4, y - 26, 5, 14, 3); ctx.fill();
      ctx.fillStyle = C.yellow; ctx.beginPath(); ctx.moveTo(x, y - 16); ctx.lineTo(x + 18, y + 10); ctx.lineTo(x - 18, y + 10); ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(x, y + 1, 3.5, 0, 7); ctx.fill();
      if (v >= 3) { ctx.fillStyle = `rgba(255,140,60,${0.5 + Math.sin(t * 30) * 0.3})`; ctx.beginPath(); ctx.moveTo(x - 6, y + 11); ctx.lineTo(x + 6, y + 11); ctx.lineTo(x, y + 20 + Math.sin(t * 40) * 3); ctx.fill(); }
      s.pops.forEach(p => { ctx.globalAlpha = 1 - p.t / 0.8; text(p.s, p.x, p.y, 14, p.c, 800, 'center'); }); ctx.globalAlpha = 1;
      text('점수 ' + s.score, 12, 16, 13, C.yellow, 800);
      if (v >= 2) text('♥'.repeat(s.lives) + '♡'.repeat(3 - s.lives), W - 12, 16, 13, C.pink, 700, 'right');
    },
  };
  function burst(s, x, y, c, n) { for (let i = 0; i < n; i++) s.parts.push({ x, y, vx: rnd(-90, 90), vy: rnd(-120, -20), t: 0, c }); }

  // ───────────── 과학고: 포물선 + 공기 저항 시뮬레이터 ─────────────
  function traj(deg, c) {
    const v0 = 30, g = 9.8, dt = 0.01, a = deg * Math.PI / 180;
    let x = 0, y = 0, vx = v0 * Math.cos(a), vy = v0 * Math.sin(a); const pts = [[0, 0]];
    for (let i = 0; i < 4000; i++) {
      const sp = Math.hypot(vx, vy); vx += -c * sp * vx * dt; vy += (-g - c * sp * vy) * dt; x += vx * dt; y += vy * dt;
      if (y < 0) { const f = pts[pts.length - 1][1] / (pts[pts.length - 1][1] - y); pts.push([pts[pts.length - 1][0] + (x - pts[pts.length - 1][0]) * f, 0]); break; }
      pts.push([x, y]);
    }
    return pts;
  }
  const DRAG = 0.006;
  const sim = {
    id: 'sim', prompts: ['포물선 운동 시뮬레이터 만들어 줘 (초속도 30 m/s)', '공기 저항을 넣고, 없을 때와 비교해 줘', '발사각을 바꿔 가며 최대 사거리 각도를 찾아 줘'],
    hint: '공기 저항이 있으면 45°가 최적이 아니에요',
    init() {
      this.free = traj(45, 0); this.drag = traj(45, DRAG);
      this.sweep = []; for (let d = 5; d <= 85; d += 1) { const p = traj(d, DRAG); this.sweep.push([d, p[p.length - 1][0]]); }
      this.best = this.sweep.reduce((a, b) => (b[1] > a[1] ? b : a));
      this.fan = [...new Set([20, 30, this.best[0], 55, 70])].sort((a, b) => a - b).map(d => ({ d, p: traj(d, DRAG) }));
      this.maxY = Math.max(...[this.free, ...this.fan.map(f => f.p)].flat().map(q => q[1])) * 1.12;
    },
    reset() { this.t = 0; },
    update(dt) { this.t += dt; },
    draw(v) {
      ctx.fillStyle = C.panel; ctx.fillRect(0, 0, W, H);
      const inset = v >= 3 && W > 300;
      const pad = 16, gy = H - 22, maxX = 95, maxY = this.maxY;
      const sx = (W - pad * 2) / maxX, sy = (gy - 44) / maxY;
      const X = x => pad + x * sx, Y = y => gy - y * sy;
      ctx.strokeStyle = 'rgba(255,255,255,.06)'; ctx.lineWidth = 1;
      for (let m = 0; m <= maxX; m += 10) { ctx.beginPath(); ctx.moveTo(X(m), 22); ctx.lineTo(X(m), gy); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.beginPath(); ctx.moveTo(pad, gy); ctx.lineTo(W - pad, gy); ctx.stroke();
      text('0', X(0), gy + 11, 10, C.dim, 500, 'center'); text('50 m', X(50), gy + 11, 10, C.dim, 500, 'center'); text('90 m', X(90), gy + 11, 10, C.dim, 500, 'center');
      const path = (pts, color, w, dash, upto = 1) => {
        const n = Math.max(2, Math.floor(pts.length * upto)); ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = w; ctx.setLineDash(dash || []); ctx.beginPath();
        for (let i = 0; i < n; i++) ctx.lineTo(X(pts[i][0]), Y(pts[i][1])); ctx.stroke(); ctx.restore(); return pts[n - 1];
      };
      const ball = (p, color) => { ctx.save(); ctx.shadowColor = color; ctx.shadowBlur = 12; ctx.fillStyle = color; ctx.beginPath(); ctx.arc(X(p[0]), Y(p[1]), 5, 0, 7); ctx.fill(); ctx.restore(); };
      const cyc = (this.t % 2.6) / 2.2;
      if (v === 1) {
        const p = path(this.free, C.sky, 2.5, null, ease(cyc)); ball(p, C.sky);
        text('θ = 45°  ·  공기 저항 없음', 14, 14, 12, C.text, 700);
        if (cyc >= 1) text('사거리 ' + this.free[this.free.length - 1][0].toFixed(1) + ' m', X(this.free[this.free.length - 1][0]), gy - 12, 12, C.sky, 800, 'right');
      } else if (v === 2) {
        path(this.free, 'rgba(125,180,255,.55)', 2, [5, 5]);
        const p = path(this.drag, C.yellow, 2.5, null, ease(cyc)); ball(p, C.yellow);
        text('- - 저항 없음 ' + this.free[this.free.length - 1][0].toFixed(0) + ' m', 14, 14, 12, C.sky, 700);
        text('—  저항 있음 ' + this.drag[this.drag.length - 1][0].toFixed(0) + ' m', 14, 31, 12, C.yellow, 700);
      } else {
        const reveal = clamp(this.t / 2.2, 0, 1);
        this.fan.forEach((f, i) => {
          const isBest = f.d === this.best[0];
          if (i / this.fan.length > reveal) return;
          path(f.p, isBest ? C.mint : `hsla(${210 + i * 25},80%,70%,.55)`, isBest ? 3 : 1.5);
          if (!isBest) { const top = f.p.reduce((m, q) => (q[1] > m[1] ? q : m)); text(f.d + '°', X(top[0]), Y(top[1]) - 8, 10, C.dim, 600, 'center'); }
        });
        if (reveal >= 1) { const e = this.fan.find(f => f.d === this.best[0]).p; ball(e[e.length - 1], C.mint); }
        text('공기 저항 있을 때 최적 발사각', 14, 14, 12, C.text, 700);
        text('≈ ' + this.best[0] + '° (45°보다 작아요)', 14, 32, 13, C.mint, 800);
        if (inset) {
          const iw = Math.min(150, W * 0.36), ih = 64, ix = W - iw - 12, iy = 10;
          rr(ix, iy, iw, ih, 8); ctx.fillStyle = 'rgba(11,18,32,.85)'; ctx.fill(); ctx.strokeStyle = C.line; ctx.stroke();
          const mx = Math.max(...this.sweep.map(s2 => s2[1]));
          ctx.strokeStyle = C.mint; ctx.lineWidth = 1.5; ctx.beginPath();
          this.sweep.forEach(([d, r], i) => { if (i / this.sweep.length <= reveal) ctx.lineTo(ix + 8 + (d - 5) / 80 * (iw - 16), iy + ih - 12 - r / mx * (ih - 26)); });
          ctx.stroke();
          const bx = ix + 8 + (this.best[0] - 5) / 80 * (iw - 16);
          if (reveal >= 1) { ctx.fillStyle = C.mint; ctx.beginPath(); ctx.arc(bx, iy + 14, 3, 0, 7); ctx.fill(); }
          text('사거리 vs 발사각', ix + 8, iy + ih - 5, 9, C.dim, 600);
        }
      }
    },
  };

  // ───────────── 중고등: 단어 퀴즈 앱 ─────────────
  const WORDS = [['photosynthesis', '광합성'], ['gravity', '중력'], ['evaporate', '증발하다'], ['molecule', '분자'], ['orbit', '궤도']];
  const app = {
    id: 'app', prompts: ['영어 단어장 앱 만들어 줘. 뜻 맞히기 퀴즈로', '틀린 단어는 더 자주 나오게 해 줘', '일주일 정답률을 그래프로 보여 줘'],
    hint: '수행평가·탐구 보고서까지 이어지는 웹앱',
    reset() { this.t = 0; this.i = 0; this.w = WORDS.map(() => 1); this.ok = null; this.flip = 0; this.next = 1.7; this.right = 0; this.total = 0; this.tag = 0; },
    update(dt, v) {
      this.t += dt; this.next -= dt; this.flip = Math.min(1, this.flip + dt * 2.2); this.tag = Math.max(0, this.tag - dt);
      if (this.next <= 0) {
        this.next = 1.7; this.flip = 0;
        const ok = Math.random() > (v >= 2 ? 0.3 + this.w[this.i] * 0.05 : 0.25);
        this.ok = ok; this.total++; if (ok) this.right++;
        if (v >= 2) { this.w[this.i] = ok ? Math.max(1, this.w[this.i] - 1) : this.w[this.i] + 2; }
        if (v >= 2) { const sum = this.w.reduce((a, b) => a + b, 0); let r = Math.random() * sum, k = 0; while ((r -= this.w[k]) > 0 && k < this.w.length - 1) k++; this.tag = this.w[k] > 1 ? 1.4 : 0; this.i = k; }
        else this.i = (this.i + 1) % WORDS.length;
      }
    },
    draw(v) {
      ctx.fillStyle = C.panel; ctx.fillRect(0, 0, W, H);
      const wide = W > 360;
      const cw = v >= 2 && wide ? W * 0.5 : W - 32, ch = v >= 3 ? H * 0.5 : H - 40;
      const cx = 16 + cw / 2, cy = (v >= 3 ? 14 : 20) + ch / 2;
      const f = this.flip, sc = Math.abs(Math.cos(f * Math.PI));
      ctx.save(); ctx.translate(cx, cy); ctx.scale(Math.max(0.02, sc), 1);
      rr(-cw / 2, -ch / 2, cw, ch, 14); ctx.fillStyle = f < 0.5 ? '#1e2b4a' : '#22385e'; ctx.fill(); ctx.strokeStyle = 'rgba(125,180,255,.35)'; ctx.stroke();
      const [en, ko] = WORDS[this.i];
      if (f < 0.5) { text(en, 0, -6, Math.min(22, cw / 8), C.text, 800, 'center'); text('뜻은?', 0, 18, 11, C.dim, 600, 'center'); }
      else { text(ko, 0, -6, 22, C.yellow, 800, 'center'); if (this.ok != null) text(this.ok ? '✓ 정답' : '✗ 다시 나와요', 0, 18, 12, this.ok ? C.mint : C.red, 800, 'center'); }
      ctx.restore();
      if (v >= 2 && this.tag > 0) { rr(cx - 46, cy - ch / 2 - 2, 92, 18, 9); ctx.fillStyle = C.pink; ctx.fill(); text('틀린 단어 다시!', cx, cy - ch / 2 + 7, 10, C.ink, 800, 'center'); }
      if (v >= 2 && wide) {
        const lx = 32 + cw, lw = W - lx - 14; text('복습 가중치', lx, 16, 11, C.dim, 700);
        WORDS.forEach(([en2], k) => {
          const y = 34 + k * (v >= 3 ? 15 : 22); text(en2.slice(0, 10), lx, y, 10, k === this.i ? C.text : C.dim, 600);
          const bw = Math.min(lw - 70, this.w[k] * 10); rr(lx + 70, y - 4, Math.max(4, bw), 8, 4); ctx.fillStyle = this.w[k] > 1 ? C.pink : C.sky; ctx.fill();
        });
      }
      if (v >= 3) {
        const days = ['월', '화', '수', '목', '금', '토', '일'], vals = [52, 58, 61, 70, 74, 81, 88];
        const by = H - 16, top = H * 0.58 + 10, bw = (W - 110) / 7;
        days.forEach((d, k) => { const p = ease(clamp(this.t * 1.2 - k * 0.12, 0, 1)); const h = (by - top) * vals[k] / 100 * p; rr(16 + k * bw + 3, by - h, bw - 6, h, 3); ctx.fillStyle = k === 6 ? C.mint : 'rgba(94,230,168,.45)'; ctx.fill(); text(d, 16 + k * bw + bw / 2, by + 8, 9, C.dim, 600, 'center'); });
        const rx = W - 46, ry = (top + by) / 2, R = Math.min(26, (by - top) / 2 + 2), acc = 0.86 * ease(clamp(this.t, 0, 1));
        ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(255,255,255,.1)'; ctx.beginPath(); ctx.arc(rx, ry, R, 0, 7); ctx.stroke();
        ctx.strokeStyle = C.mint; ctx.beginPath(); ctx.arc(rx, ry, R, -Math.PI / 2, -Math.PI / 2 + acc * Math.PI * 2); ctx.stroke();
        text(Math.round(acc * 100) + '%', rx, ry, 12, C.text, 800, 'center');
      }
    },
  };

  // ───────────── 성인: 주문 엑셀 정리 도구 ─────────────
  const ROWS = [['11/18', ' 아메리카노 ', 3, 12000], ['11/18', '라떼', 2, null], ['11/18', '아메리카노', 1, 4000], ['11/19', 'LATTE', 4, 18000], ['11/19', '아메리카노', 3, 12000], ['11/19', '아메리카노', 3, 12000], ['11/20', '케이크', 2, 13000]];
  const tool = {
    id: 'tool', prompts: ['주문 엑셀을 넣으면 정리해 주는 도구 만들어 줘', '같은 품목끼리 합치고, 빈 금액은 계산, 중복은 표시', '품목별 합계를 그래프로, 인쇄도 되게'],
    hint: '반복 업무 2시간 → 20분, 직접 만든 도구로',
    reset() { this.t = 0; },
    update(dt) { this.t += dt; },
    draw(v) {
      ctx.fillStyle = C.panel; ctx.fillRect(0, 0, W, H);
      const p = this.t; const wide = W > 380;
      const tw = v >= 2 && wide ? W * 0.55 : W - 24, rh = Math.min(22, (H - 34) / (ROWS.length + 1));
      const x0 = 12, y0 = 12;
      rr(x0, y0, tw, rh * (ROWS.length + 1) + 4, 8); ctx.fillStyle = 'rgba(255,255,255,.03)'; ctx.fill(); ctx.strokeStyle = C.line; ctx.stroke();
      const cols = [0, 0.22, 0.62, 0.76];
      ['날짜', '품목', '수량', '금액'].forEach((h, k) => text(h, x0 + 8 + cols[k] * tw, y0 + rh / 2 + 2, 10, C.dim, 700));
      ROWS.forEach((r, k) => {
        const show = clamp((p - k * 0.18) * 4, 0, 1); if (show <= 0) return;
        const y = y0 + rh * (k + 1) + rh / 2 + 2; ctx.globalAlpha = show;
        const fix = v >= 2 ? ease(clamp((p - 1.6 - k * 0.15) * 2, 0, 1)) : 0;
        const dup = v >= 2 && k === 5 && fix > 0.5;
        if (dup) { ctx.fillStyle = 'rgba(255,107,107,.14)'; ctx.fillRect(x0 + 2, y - rh / 2, tw - 4, rh); }
        let name = r[1], nameColor = C.text;
        if (v >= 2 && fix > 0.5) { const norm = r[1].trim() === 'LATTE' ? '라떼' : r[1].trim(); if (norm !== r[1]) nameColor = C.mint; name = norm; }
        text(dup ? '중복' : r[0], x0 + 8, y, 11, dup ? C.red : C.dim, dup ? 800 : 500); text(name.length > 7 && !wide ? name.slice(0, 6) + '…' : name, x0 + 8 + cols[1] * tw, y, 11, nameColor, 600);
        text(String(r[2]), x0 + 8 + cols[2] * tw, y, 11, C.text, 600);
        let price = r[3] == null ? '' : r[3].toLocaleString(), pc = C.text;
        if (r[3] == null && v >= 2 && fix > 0.5) { price = '9,000'; pc = C.yellow; }
        else if (r[3] == null) { price = '?'; pc = C.red; }
        text(price, x0 + 8 + cols[3] * tw, y, 11, pc, 600);
        ctx.globalAlpha = 1;
      });
      if (v >= 2) {
        const sums = [['아메리카노', 7, 28000], ['라떼', 6, 27000], ['케이크', 2, 13000]];
        const show = ease(clamp((p - 2.6) * 1.5, 0, 1)); if (show <= 0) return;
        ctx.globalAlpha = show;
        if (wide) {
          const sx = x0 + tw + 12, sw = W - sx - 12;
          text('품목별 합계', sx, y0 + 8, 11, C.dim, 700);
          sums.forEach(([n, q, m], k) => {
            const y = y0 + 30 + k * (v >= 3 ? 40 : 26);
            text(n, sx, y, 11, C.text, 700); text(m.toLocaleString() + '원', sx + sw, y, 11, C.yellow, 800, 'right');
            if (v >= 3) { const bw = (sw) * m / 28000 * ease(clamp((p - 3.2) * 1.2, 0, 1)); rr(sx, y + 9, bw, 9, 4); ctx.fillStyle = [C.sky, C.mint, C.pink][k]; ctx.fill(); }
          });
        } else {
          rr(W - 130, H - 44, 118, 34, 8); ctx.fillStyle = 'rgba(11,18,32,.92)'; ctx.fill();
          text('합계 68,000원', W - 71, H - 27, 12, C.yellow, 800, 'center');
        }
        ctx.globalAlpha = 1;
      }
      if (v >= 3) {
        const b = ease(clamp((p - 3.8) * 1.5, 0, 1)); if (b <= 0) return;
        ctx.globalAlpha = b; const bw = 132, bx = W - bw - 12, by = H - 34;
        rr(bx, by, bw, 24, 12); ctx.fillStyle = C.mint; ctx.fill(); text('주 120분 → 20분', bx + bw / 2, by + 12, 12, C.ink, 800, 'center'); ctx.globalAlpha = 1;
      }
    },
  };

  const tracks = [game, app, sim, tool];
  sim.init();

  // ───────────── 진행(프롬프트 타이핑 → 만드는 중 → 실행) ─────────────
  const pointer = { x: 0, active: false, t: 0 };
  cv.addEventListener('pointermove', e => { const r = cv.getBoundingClientRect(); pointer.x = e.clientX - r.left; pointer.active = true; pointer.t = performance.now(); });
  cv.addEventListener('pointerdown', e => { const r = cv.getBoundingClientRect(); pointer.x = e.clientX - r.left; pointer.active = true; pointer.t = performance.now(); });

  let cur = 0, ver = 0, phase = 'type', clock = 0, chars = 0, locked = false;
  const RUN = [0, 3.4, 3.6, 7.5];
  function setTrack(i) {
    cur = i; ver = 0; phase = 'type'; clock = 0; chars = 0;
    tracks[i].reset(); renderPrompts();
    tabs.forEach((b, k) => { b.setAttribute('aria-pressed', String(k === i)); b.classList.toggle('is-on', k === i); });
    if (hintEl) hintEl.textContent = tracks[i].hint;
  }
  function renderPrompts() {
    const t = tracks[cur];
    promptList.innerHTML = t.prompts.map((s, k) => {
      if (k > ver) return '';
      const typing = k === ver && phase === 'type';
      const body = typing ? esc(s.slice(0, chars)) + '<span class="pm-caret"></span>' : esc(s);
      const state = k < ver || (k === ver && phase !== 'type') ? (k === ver && phase === 'build' ? '<span class="pm-state pm-build">만드는 중</span>' : '<span class="pm-state">v' + (k + 1) + ' ✓</span>') : '';
      return `<li class="${k < ver ? 'pm-old' : ''}"><span class="pm-you">나</span><span class="pm-text">${body}</span>${state}</li>`;
    }).join('');
    const shown = phase === 'type' ? ver : ver + 1;
    verEl.textContent = shown ? 'v' + shown : '시작 전';
    stepEls.forEach((el, k) => el.classList.toggle('on', k < shown));
  }
  function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

  let last = 0, visible = true;
  function frame(now) {
    const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
    if (visible && !document.hidden) step(dt, now / 1000);
    requestAnimationFrame(frame);
  }
  function step(dt, t) {
    const tr = tracks[cur];
    clock += dt;
    if (phase === 'type') {
      const n = Math.floor(clock / 0.045);
      if (n !== chars) { chars = Math.min(n, tr.prompts[ver].length); renderPrompts(); }
      if (chars >= tr.prompts[ver].length && clock > tr.prompts[ver].length * 0.045 + 0.35) { phase = 'build'; clock = 0; renderPrompts(); }
    } else if (phase === 'build') {
      if (clock > 0.8) { phase = 'run'; clock = 0; if (ver === 0) tr.reset(); renderPrompts(); }
    } else if (clock > RUN[ver + 1]) {
      if (ver < 2) { ver++; phase = 'type'; clock = 0; chars = 0; renderPrompts(); }
      else if (!locked) setTrack((cur + 1) % tracks.length);
      else clock = 0;
    }
    const v = phase === 'run' ? ver + 1 : ver;
    if (v >= 1) { if (reduce) { if ('t' in tr) tr.t = 10; } else tr.update(dt, v); }
    ctx.clearRect(0, 0, W, H);
    if (v >= 1) tr.draw(v, t);
    else { ctx.fillStyle = C.panel; ctx.fillRect(0, 0, W, H); text('프롬프트를 보내면 여기에 결과가 나와요', W / 2, H / 2, 12, C.dim, 600, 'center'); }
    if (phase === 'build') {
      const g = ctx.createLinearGradient(0, 0, W, 0), x = (clock / 0.8) * 1.4 - 0.2;
      g.addColorStop(clamp(x - 0.2, 0, 1), 'rgba(59,130,246,0)'); g.addColorStop(clamp(x, 0, 1), 'rgba(125,180,255,.28)'); g.addColorStop(clamp(x + 0.2, 0, 1), 'rgba(59,130,246,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      text('AI가 v' + (ver + 1) + ' 만드는 중…', W / 2, H - 14, 11, C.sky, 700, 'center');
    }
  }

  tabs.forEach((b, i) => b.addEventListener('click', () => { locked = true; setTrack(i); }));
  window.addEventListener('resize', resize);
  if ('IntersectionObserver' in window) new IntersectionObserver(es => es.forEach(e => { visible = e.isIntersecting; })).observe(root);
  resize();
  setTrack(0);
  if (reduce) {
    // 움직임 줄이기: 각 트랙을 완성본(v3)으로 고정 표시
    ver = 2; phase = 'run'; clock = 0; locked = true; renderPrompts();
    tabs.forEach((b, i) => b.addEventListener('click', () => { ver = 2; phase = 'run'; renderPrompts(); }));
  }
  requestAnimationFrame(frame);
})();
