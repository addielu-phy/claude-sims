// 物理核心稽核：直接從 index.html 載入 <script id="physics-core">，檢查答案與一般性質。
// 執行：node audit.cjs
'use strict';
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const m = html.match(/<script id="physics-core">([\s\S]*?)<\/script>/);
if (!m) throw new Error('physics-core script not found');
const mod = { exports: {} };
new Function('module', m[1])(mod);
const P = mod.exports;

let checks = 0, fails = 0;
const ok = (cond, msg) => { checks++; if (!cond) { fails++; if (fails <= 20) console.log('FAIL:', msg); } };
const close = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;
const p0 = { W: 2, mus: 0.5, muk: 0.4 };
const B = P.B, H = P.H;

// ---- 題目答案 ----
const T = P.thresholds(p0);
ok(close(T.Fs, 1) && close(T.Fk, 0.8) && close(T.C, 2), '門檻值 Fs=1, Fk=0.8, C=2');
ok(close(T.h1, 2), '(1) h = 2 m');
const e1 = P.rampEvent(p0, 2);
ok(e1.type === 'both' && close(e1.Fev, 1), '(1) h=2 時同時滑動與傾倒，F=1');
const q1 = P.equilibrium(p0, 1, 2);
ok(close(q1.dReq, 0), '(1) 臨界時 d = 0');
ok(close(T.hMax, 2.5), '(2) h_max = 2.5 m');
ok(close(P.equilibrium(p0, 0.8, 2.5).dReq, 0), '(2) h=2.5 等速時 d=0');
ok(!P.equilibrium(p0, 0.8, 2.55).feasible, '(2) h=2.55 會傾倒');
ok(P.equilibrium(p0, 0.8, 2.45).feasible, '(2) h=2.45 不傾倒');
const q3 = P.equilibrium(p0, 0.8, 1.5);
ok(close(q3.tauNreq, 0.8), '(3) τN = 0.8 kgw·m');
ok(close(q3.dReq, 0.4), '(3) d = 0.4 m');
ok(close(q3.tauF, 1.2) && close(q3.tauW, -2) && q3.tauf === 0, '(3) τF=1.2, τW=−2, τf=0');
ok(P.classify(p0, 0.8, 1.5).kind === 'rest', '(3) F=0.8 在 h=1.5 時靜止');
// 對質心 G 驗算 (3)：F 在 G 下方 0.5 m 向左（順時針 −），f 在 G 下方 2 m 向右（逆時針 +），N 在 G 左方 0.6 m 向上（順時針 −）
ok(close(-0.8 * 0.5 + 0.8 * 2 - 2 * (1 - 0.4), 0), '(3) 對 G 取力矩合為 0');
// 「想一想」
ok(P.rampEvent(p0, 3).type === 'tip' && close(P.rampEvent(p0, 3).Fev, 2 / 3), 'Q1：h=3 先傾倒，F=2/3');
ok(close(P.equilibrium(p0, 0.8, 0.5).dReq, 0.8), 'Q2：h=0.5 時 d=0.8');
ok(close(P.thresholds({ W: 2, mus: 0.25, muk: 0.2 }).h1, 4), 'Q3：μs=0.25 時 h=4');
ok(close(P.thresholds({ W: 7, mus: 0.5, muk: 0.4 }).h1, 2), 'Q4：h1 與 W 無關');
// 表格
ok(close(P.tipForce(p0, 1.5), 4 / 3) && P.rampEvent(p0, 1.5).type === 'slide', '表：h=1.5 先滑動，傾倒需 1.33');

// ---- 全範圍掃描（題目數值與多組 μ、W）----
const sets = [p0];
for (const W of [1, 2, 5]) for (const mus of [0.2, 0.35, 0.5, 0.8, 1]) for (const muk of [0.1, 0.3, 0.5]) if (muk <= mus) sets.push({ W, mus, muk });
for (const p of sets) {
  const t = P.thresholds(p);
  for (let hi = 0; hi <= 80; hi++) {
    const h = hi * 0.05;
    const ev = P.rampEvent(p, h);
    ok(close(ev.Fev, Math.min(t.Fs, P.tipForce(p, h)), 1e-9), 'Fev = min(Fs, Ft)');
    for (let Fi = 0; Fi <= 250; Fi++) {
      const F = Fi * 0.01;
      const e = P.equilibrium(p, F, h);
      // 力矩平衡（對 O）
      ok(close(e.tauF + e.tauW + e.N * e.dReq, 0, 1e-12), '對 O 力矩平衡');
      // 對 G 也平衡（只在可行時有意義）
      if (e.feasible) {
        const tauG = -F * (H / 2 - h) + e.f * (H / 2) - e.N * (B / 2 - e.dReq);
        ok(close(tauG, 0, 1e-9), `對 G 力矩平衡 F=${F} h=${h}`);
        ok(e.dReq <= B / 2 + 1e-12, 'd ≤ b/2（推力只會讓作用點往 O 移）');
      }
      // 靜止 ⇔ F < Fs 且 F·h < C
      const c = P.classify(p, F, h);
      const rest = F < t.Fs - 1e-6 && F * h < t.C - 1e-6 * Math.max(1, h);
      if (c.kind === 'rest') ok(rest || close(F, ev.Fev, 1e-6), `rest 分類 F=${F} h=${h}`);
      if (c.kind === 'event') ok(!rest, `event 分類 F=${F} h=${h}`);
      // 傾倒角加速度的正負 ⇔ F·h 與 W×1 比較
      const a0 = P.tipAlpha(p, F, h, 0);
      if (Math.abs(F * h - t.C) > 1e-9) ok((a0 > 0) === (F * h > t.C), 'tipAlpha 正負');
    }
    // 等速滑動時（F = Fk）兩種 d 公式一致
    ok(close(P.slidingD(p, t.Fk, h), P.equilibrium(p, t.Fk, h).dReq, 1e-12), 'slidingD 與 equilibrium 一致');
    // 「先滑動」的情況：若 h1 ≤ H/2（含題目數值），滑動後不會再傾倒；
    // h1 > H/2（μs < b/H）時可能滑動中翻倒，頁面的 step() 會用 slidingD 判斷並切換成傾倒動畫。
    if (ev.type === 'slide' && t.h1 <= H / 2 + 1e-12) for (const F of [t.Fs, t.Fs * 1.2, t.Fs * 2]) ok(P.slidingD(p, F, h) >= -1e-9, '先滑動者滑動中不傾倒');
  }
}

// ---- 支撐力分布：合力 = N、合力作用點 = d、非負 ----
for (const N of [1, 2, 5]) for (let di = 1; di <= 100; di++) {
  const d = di / 100 * (B / 2);
  const n = 20000; let S0 = 0, S1 = 0, neg = false;
  for (let i = 0; i < n; i++) { const y = (i + 0.5) / n * B; const pr = P.pressure(N, d, y); if (pr < -1e-12) neg = true; S0 += pr * B / n; S1 += pr * y * B / n; }
  ok(!neg, '分布非負');
  ok(Math.abs(S0 - N) < 2e-3 * N, `分布合力 = N（d=${d}）`);
  ok(Math.abs(S1 / S0 - d) < 2e-3, `分布作用點 = d（d=${d}）`);
}

console.log(`${fails === 0 ? 'PASS' : 'FAIL'}：${checks} 項檢查，${fails} 項失敗`);
process.exit(fails ? 1 : 0);
