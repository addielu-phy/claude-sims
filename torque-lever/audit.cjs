// 物理核心稽核：直接從 index.html 載入 <script id="physics-core">，檢查例題答案與一般性質。
// 執行：node audit.cjs
'use strict';
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const m = html.match(/<script id="physics-core">([\s\S]*?)<\/script>/);
if (!m) throw new Error('physics-core script not found');
const mod = { exports: {} };
new Function('module', m[1]).call({}, mod);
const P = mod.exports;

let checks = 0, fails = 0;
const ok = (cond, msg) => { checks++; if (!cond) { fails++; if (fails <= 20) console.log('FAIL:', msg); } };
const close = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;

// ---- 例題答案 ----
// 例 1 翹翹板：60×1 = 20×d → d = 3；支點 80
{ const r = P.lever([{ x: -1, m: 60 }, { x: 3, m: 20 }], 0, 0); ok(r.balanced && close(r.pivotForce, 80), '例1 d=3 m 平衡，支點 80 kgw'); }
// 例 2 米尺：20 cm 30 gw、90 cm 10 gw，20 gw 掛 75 cm
{ const base = [{ x: 20, m: 30 }, { x: 90, m: 10 }];
  const r0 = P.lever(base, 50, 0); ok(close(r0.ccw, 900) && close(r0.cw, 400) && close(r0.net, 500), '例2 目前 逆900 順400 差500');
  const r = P.lever(base.concat([{ x: 75, m: 20 }]), 50, 0); ok(r.balanced, '例2 75 cm 平衡');
  for (let x = 0; x <= 100; x += 5) if (x !== 75) ok(!P.lever(base.concat([{ x, m: 20 }]), 50, 0).balanced, '例2 只有 75 cm 平衡 (x=' + x + ')');
  ok(close(r.pivotForce, 60), '例2 支點 60 gw'); }
// 例 3 尺重：支點 40，尺重 100 在 50，0 cm 掛 25 gw；支點 125
{ const r = P.lever([{ x: 0, m: 25 }], 40, 100, 50); ok(r.balanced && close(r.pivotForce, 125), '例3 25 gw 平衡，支點 125 gw');
  ok(!P.lever([{ x: 0, m: 20 }], 40, 100, 50).balanced, '例3 20 gw 不平衡');
  ok(P.lever([], 50, 100, 50).balanced, '支點在中點時尺重力矩 0'); }
// 例 4 扳手：r=25, F=4 → 100、50、0
ok(close(P.wrench(25, 90, 4, true).L, 100) && P.wrench(25, 90, 4, true).dir === 'cw', '例4 垂直 100，順時針');
ok(close(P.wrench(25, 30, 4, true).L, 50, 1e-9) && close(P.wrench(25, 30, 4, true).d, 12.5, 1e-9), '例4 30° 力臂 12.5，力矩 50');
ok(P.wrench(25, 0, 4, true).L === 0 && P.wrench(25, 0, 4, true).dir === 'none', '例4 沿桿 0');
ok(P.wrench(25, 180, 4, false).L === 0, '180° 也是 0');
ok(P.wrench(25, 90, 4, false).dir === 'ccw', '往上拉 → 逆時針');
// 例 5 獨輪車：p=0, e=120, r=40, R=60 → F=20，手 30 cm → 貨 10 cm，功 600 = 600
{ const e = P.effort(60, 0, 120, 40, 30); ok(close(e.F, 20) && close(e.sR, 10) && close(e.workIn, 600) && close(e.workOut, 600), '例5 F=20, sR=10, 功 600');
  ok(e.type === 2 && e.kind === 'save' && e.up === true, '例5 抗力點在中間、省力、向上施力'); }
// 例 6 釣竿：p=0, e=30, r=120, R=1 → F=4；手 5 cm → 竿尖 20 cm
{ const e = P.effort(1, 0, 30, 120, 5); ok(close(e.F, 4) && close(e.sR, 20), '例6 F=4, sR=20'); ok(e.type === 3 && e.kind === 'cost', '例6 施力點在中間、費力'); }
// 例 7 會考 111-33：L1 = F·20 + F·20，L2 = F·40
{ for (const F of [1, 2.5, 7]) { const L1 = P.wrench(20, 90, F, true).L + P.wrench(20, 90, F, true).L; const L2 = P.wrench(40, 90, F, true).L; ok(close(L1, L2), '例7 L1 = L2 (F=' + F + ')'); } }
// 觀念檢查 Q2：20 gw @10 cm vs 20 gw @90 cm（支點 50）
ok(P.lever([{ x: 10, m: 20 }, { x: 90, m: 20 }], 50, 0).balanced, 'Q2 (B) 平衡');
ok(!P.lever([{ x: 10, m: 20 }, { x: 90, m: 40 }], 50, 0).balanced && !P.lever([{ x: 10, m: 20 }, { x: 70, m: 20 }], 50, 0).balanced && !P.lever([{ x: 10, m: 20 }, { x: 60, m: 20 }], 50, 0).balanced, 'Q2 其他選項不平衡');
// 分類器預設情境
const EX = { seesaw: [60, 10, 85, 1], scissors: [50, 0, 80, 1], opener: [0, 100, 10, 2], barrow: [0, 120, 40, 2], tweezers: [0, 40, 120, 3], rod: [0, 30, 120, 3] };
for (const k in EX) { const [p, e, r, t] = EX[k]; ok(P.classify(p, e, r) === t, '分類 ' + k); }
ok(P.effort(30, 0, 100, 10).kind === 'save' && P.effort(2, 0, 40, 120).kind === 'cost', '開瓶器省力、鑷子費力');

// ---- 全範圍掃描 ----
// 扳手：0~180°、r 5~50：力臂 ≤ r，90° 最大，θ 與 180−θ 對稱
for (let r = 5; r <= 50; r++) for (let th = 0; th <= 180; th++) {
  const d = P.arm(r, th);
  ok(d >= 0 && d <= r + 1e-12, '力臂 ≤ r');
  ok(close(d, P.arm(r, 180 - th), 1e-9), '對稱');
  ok(d <= P.arm(r, 90) + 1e-12, '90° 最大');
  for (const F of [1, 5, 10]) ok(close(P.wrench(r, th, F, true).L, F * d, 1e-9), 'L = F d');
}
// 米尺：隨機砝碼組合，力矩和定義與「平衡 ⇔ Σ m·(x−p) = 0」一致；支點力 = 總重
let seed = 12345; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
for (let n = 0; n < 200000; n++) {
  const p = 10 + 5 * Math.floor(rnd() * 17), k = 1 + Math.floor(rnd() * 5), loads = [];
  for (let i = 0; i < k; i++) loads.push({ x: 5 * Math.floor(rnd() * 21), m: [10, 20, 50][Math.floor(rnd() * 3)] });
  const rw = rnd() < 0.5 ? 100 : 0;
  const r = P.lever(loads, p, rw, 50);
  const mom = loads.reduce((s, l) => s + l.m * (l.x - p), 0) + rw * (50 - p);
  ok(close(r.net, -mom, 1e-9), 'net = −Σ m(x−p)');
  ok(r.balanced === (Math.abs(mom) < 1e-9), '平衡判斷');
  ok(close(r.pivotForce, loads.reduce((s, l) => s + l.m, 0) + rw), '支點力 = 總重');
  ok(close(r.cw + r.ccw, loads.reduce((s, l) => s + l.m * Math.abs(l.x - p), 0) + rw * Math.abs(50 - p), 1e-9), '順+逆 = Σ|力矩|');
}
// 分類器：所有 (p,e,r) 0~120 每 5 cm、R 1~60：F·de = R·dr；功相等；類型與省力的關係
for (let p = 0; p <= 120; p += 5) for (let e = 0; e <= 120; e += 5) for (let r = 0; r <= 120; r += 5) {
  if (p === e || p === r || e === r) continue;
  const t = P.classify(p, e, r);
  for (const R of [1, 7, 60]) {
    const s = P.effort(R, p, e, r, 30);
    ok(close(s.F * s.de, R * s.dr, 1e-9), 'F·de = R·dr');
    ok(close(s.workIn, s.workOut, 1e-9), '功相等');
    if (t === 2) ok(s.kind === 'save', '抗力點在中間一定省力');
    if (t === 3) ok(s.kind === 'cost', '施力點在中間一定費力');
    ok(s.up === (t !== 1), '支點在中間時施力向下，否則向上');
  }
}
console.log((fails ? 'FAIL' : 'PASS') + '，' + checks.toLocaleString('en-US') + ' 項檢查，' + fails + ' 項失敗');
process.exit(fails ? 1 : 0);
