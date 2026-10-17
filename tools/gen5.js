// レベル5の問題データ生成: node gen5.js -> src/data.js
// 手書き10問（src/handmade.js）＋ 計算で作る問題。誤答は「よくあるまちがい」から作り、理由も一緒に付ける。
const fs = require('fs'), path = require('path');

let seed = 20261020;
function R() { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const MINUS = '−';
const lab = v => (v < 0 ? MINUS + (-v) : String(v));
const T = v => String(v);
const fr = (n, d) => '\\dfrac{' + n + '}{' + d + '}';
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
function lcmBrute(a, b) { for (let x = Math.max(a, b); ; x++) if (x % a === 0 && x % b === 0) return x; }
const key = v => (v == null ? 'null:' + Math.random() : Array.isArray(v) ? v.map(x => x.toFixed(9)).join(',') : v.toFixed(9));

/* 問題を組み立てる。truth={v,tex}, cands=[{v,tex,why}]（先のものほど優先） */
function build(o) {
  const unit = o.unit || '';
  const wrap = (tex, raw) => (raw ? tex : '$' + tex + '$' + unit);
  const seen = [o.truth.tex], seenV = [key(o.truth.v)], wrongs = [];
  for (const c of o.cands) {
    if (wrongs.length >= 3) break;
    if (seen.includes(c.tex)) continue;
    if (!c.same && seenV.includes(key(c.v))) continue;
    seen.push(c.tex); seenV.push(key(c.v)); wrongs.push(c);
  }
  if (wrongs.length < 3) throw new Error(o.id + ': 誤答の候補が足りない');
  const all = shuffle([{ t: wrap(o.truth.tex, o.truth.raw), v: o.truth.v, ok: true }].concat(wrongs.map(c => (c.same ? { t: wrap(c.tex, c.raw), v: c.v, why: c.why, same: true } : { t: wrap(c.tex, c.raw), v: c.v, why: c.why }))));
  const ans = all.findIndex(x => x.ok);
  all.forEach(x => delete x.ok);
  const q = { id: o.id, expr: o.expr, p: o.p, ch: all, ans, steps: o.steps, point: o.point };
  if (o.fig) q.fig = o.fig;
  if (o.figAfter) q.figAfter = o.figAfter;
  return q;
}

/* ---------- 共通の小物 ---------- */
const LT = a => a.join(',\\ ');                                  // 数のならび（TeX）
const dfmt = x => String(+x.toFixed(8));                         // 小数の表示
const divisors = n => { const r = []; for (let i = 1; i <= n; i++) if (n % i === 0) r.push(i); return r; };
const reduceF = (n, d) => { const g = gcd(n, d); return [n / g, d / g]; };
const frT = (n, d) => (d === 1 ? String(n) : fr(n, d));           // 分母1なら整数で表示
const Fv = (n, d) => { const [a, b] = reduceF(n, d); return { v: n / d, tex: frT(a, b) }; };
const C = (n, d, why, same) => { const o = { v: n / d, tex: (n * d < 0 ? '-' : '') + frT(Math.abs(n), Math.abs(d)), why }; if (same) o.same = true; return o; };
const mixT = (w, n, d) => String(w) + fr(n, d);
function fracOfDec(x) { const s = Math.round(x * 10000); const g = gcd(s, 10000); return [s / g, 10000 / g]; }
const RAWQ = (id, p, truth, wrongs, steps, point, extra) => build(Object.assign({
  id, expr: '1', p, raw: true, truth: { v: 1, tex: truth, raw: true },
  cands: wrongs.map(([t, why]) => ({ v: null, raw: true, tex: t, why })), steps, point
}, extra || {}));
const lcmOf = (a, b) => a / gcd(a, b) * b;

/* ---------- 共通の小物（レベル5） ---------- */
const fp = n => (n < 0 ? '(' + n + ')' : String(n));       // かっこつきで表示
const sgnWord = s => (s < 0 ? 'マイナス' : 'プラス');
const cnt = a => a.filter(x => x < 0).length;


/* ---------- 文字式の道具 ---------- */
const D = s => (String(s).includes('$') || /[ぁ-んァ-ヶ一-龥]/.test(String(s)) ? s : '$' + s + '$');
// RQ: 4択（式が選択肢）。texはそのまま渡すと $…$ で包む
const RQ = (id, p, t, ws, steps, point, extra) => RAWQ(id, p, D(t), ws.map(([w, why]) => [D(w), why]), steps, point, extra);
// 1次式 a x + b を TeX に
const xt = (a, v) => (a === 1 ? v : a === -1 ? '-' + v : a + v);
const lin = (a, b, v) => { v = v || 'x'; if (a === 0) return String(b); let s = xt(a, v); if (b > 0) s += '+' + b; else if (b < 0) s += '-' + (-b); return s; };
const sgn = n => (n < 0 ? '-' + (-n) : '+' + n);
const num = n => String(n);
// 数値問題（答えがひとつの数）
const NQ = (id, p, t, ws, steps, point, unit) => build({ id, expr: String(t), p, truth: { v: t, tex: dfmt(t) }, cands: ws.map(([v, why]) => ({ v, tex: dfmt(v), why })), steps, point, unit });


/* ---------- 座標グラフの図（SVG） ---------- */
const GR = 6, GS = 22, GC = 150;
const gx = x => GC + GS * x, gy = y => GC - GS * y;
function graph(o) {
  o = o || {};
  const st = (s) => ' style="' + s + '"';
  let s = '<svg viewBox="0 0 300 300" role="img" aria-label="座標平面"' + st('width:100%;max-width:340px;height:auto;display:block;margin:8px auto') + '>';
  for (let i = -GR; i <= GR; i++) {
    if (i === 0) continue;
    s += '<line x1="' + gx(i) + '" y1="' + gy(-GR) + '" x2="' + gx(i) + '" y2="' + gy(GR) + '"' + st('stroke:var(--line);stroke-width:1') + '/>';
    s += '<line x1="' + gx(-GR) + '" y1="' + gy(i) + '" x2="' + gx(GR) + '" y2="' + gy(i) + '"' + st('stroke:var(--line);stroke-width:1') + '/>';
  }
  s += '<line x1="' + gx(-GR - .4) + '" y1="' + GC + '" x2="' + gx(GR + .4) + '" y2="' + GC + '"' + st('stroke:var(--fg);stroke-width:2') + '/>';
  s += '<line x1="' + GC + '" y1="' + gy(-GR - .4) + '" x2="' + GC + '" y2="' + gy(GR + .4) + '"' + st('stroke:var(--fg);stroke-width:2') + '/>';
  const tx = 'font:700 10px sans-serif;fill:var(--muted);text-anchor:middle';
  for (let i = -GR; i <= GR; i++) {
    if (i === 0) continue;
    s += '<text x="' + gx(i) + '" y="' + (GC + 13) + '"' + st(tx) + '>' + i + '</text>';
    s += '<text x="' + (GC - 9) + '" y="' + (gy(i) + 3.5) + '"' + st(tx) + '>' + i + '</text>';
  }
  s += '<text x="' + (GC - 8) + '" y="' + (GC + 13) + '"' + st(tx) + '>O</text>';
  s += '<text x="' + gx(GR + .4) + '" y="' + (GC + 24) + '"' + st('font:700 12px sans-serif;fill:var(--fg);text-anchor:end') + '>x</text>';
  s += '<text x="' + (GC + 10) + '" y="' + (gy(GR + .4) + 8) + '"' + st('font:700 12px sans-serif;fill:var(--fg)') + '>y</text>';
  (o.lines || []).forEach(a => {                       // y = a x
    const xm = Math.min(GR, GR / Math.abs(a));
    s += '<line x1="' + gx(-xm) + '" y1="' + gy(-a * xm) + '" x2="' + gx(xm) + '" y2="' + gy(a * xm) + '"' + st('stroke:var(--neg);stroke-width:2.5;stroke-linecap:round') + '/>';
  });
  (o.hyper || []).forEach(a => {                       // y = a / x
    [1, -1].forEach(sg => {
      let pts = [];
      for (let x = Math.abs(a) / GR; x <= GR + 1e-9; x += 0.05) pts.push(gx(sg * x).toFixed(1) + ',' + gy(a / (sg * x)).toFixed(1));
      s += '<polyline points="' + pts.join(' ') + '" fill="none"' + st('stroke:var(--neg);stroke-width:2.5;stroke-linecap:round') + '/>';
    });
  });
  (o.pts || []).forEach(p => {
    s += '<circle cx="' + gx(p.x) + '" cy="' + gy(p.y) + '" r="4.5"' + st('fill:var(--pos);stroke:var(--card);stroke-width:1.5') + '/>';
    if (p.l) s += '<text x="' + (gx(p.x) + 7) + '" y="' + (gy(p.y) - 6) + '"' + st('font:700 13px sans-serif;fill:var(--pos)') + '>' + p.l + '</text>';
  });
  return { type: 'svg', html: s + '</svg>' };
}
const ct = (x, y) => '(' + x + ',' + y + ')';
const rdc = (n, d) => { const g = gcd(n, d); n /= g; d /= g; if (d < 0) { n = -n; d = -d; } return [n, d]; };
const slope = (n, d) => { [n, d] = rdc(n, d); return d === 1 ? (n === 1 ? '' : n === -1 ? '-' : String(n)) + 'x' : (n < 0 ? '-' : '') + '\\dfrac{' + Math.abs(n) + '}{' + d + '}x'; };
const yEq = (n, d) => 'y=' + slope(n, d);
const hyEq = a => 'y=' + (a < 0 ? '-' : '') + '\\dfrac{' + Math.abs(a) + '}{x}';
const QN = ['第1象限', '第2象限', '第3象限', '第4象限'];

const PI = n => (n === 1 ? '\\pi' : n + '\\pi');

/* ================= パートA: 図形のおさらい ================= */
function genTani() {
  return [
    NQ('tn-1', '3 m は、何 cm？', 300, [[30, '1 m ＝ 100 cm。10倍ではなく、100倍。'], [3000, '1 m ＝ 100 cm。1000倍は、大きすぎる。'], [0.3, '小さい単位（cm）に直すときは、数は大きくなる。']], ['1 m ＝ 100 cm。', '$3\\times100=300$。'], '1 m ＝ 100 cm、1 km ＝ 1000 m。', 'cm'),
    NQ('tn-2', '2.5 km は、何 m？', 2500, [[250, '1 km ＝ 1000 m。100倍ではなく、1000倍。'], [25000, '1 km ＝ 1000 m。10000倍は、大きすぎる。'], [25, '小さい単位（m）に直すときは、数は大きくなる。']], ['1 km ＝ 1000 m。', '$2.5\\times1000=2500$。'], '1 km ＝ 1000 m。', 'm'),
    NQ('tn-3', '4000 g は、何 kg？', 4, [[40, '1 kg ＝ 1000 g。大きい単位（kg）に直すときは、数は小さくなる。'], [400, '1 kg ＝ 1000 g。100ではなく、1000でわる。'], [0.4, '1 kg ＝ 1000 g。10000でわっているよ。']], ['1 kg ＝ 1000 g。', '$4000\\div1000=4$。'], '1 kg ＝ 1000 g。', 'kg'),
    NQ('tn-4', '1 m² は、何 cm²？', 10000, [[100, '面積は、長さの2乗。$100\\times100$ になる。'], [1000, '面積は、長さの2乗。$100\\times100$ になる。'], [100000, '$100\\times100=10000$。']], ['1 m ＝ 100 cm。', '面積は2乗：$100\\times100=10000$。'], '面積の単位換算は、長さの換算を2回かける。', 'cm²'),
    NQ('tn-5', '3 L は、何 mL？', 3000, [[30, '1 L ＝ 1000 mL。10倍ではなく、1000倍。'], [300, '1 L ＝ 1000 mL。100倍ではなく、1000倍。'], [30000, '1 L ＝ 1000 mL。10000倍は、大きすぎる。']], ['1 L ＝ 1000 mL。', '$3\\times1000=3000$。'], '1 L ＝ 1000 mL ＝ 1000 cm³。', 'mL'),
    NQ('tn-6', '1 m³ は、何 L？', 1000, [[100, '1 m³ ＝ 1000 L。（1辺10 cm の立方体が1 L、それが 10×10×10 こ）'], [10, '1 m³ ＝ 1000 L。'], [10000, '1 m³ ＝ 1000 L。10000は、大きすぎる。']], ['1 m³ ＝ 1000000 cm³。', '1 L ＝ 1000 cm³。', '$1000000\\div1000=1000$。'], '1 m³ ＝ 1000 L。', 'L'),
    NQ('tn-7', '2時間30分は、何分？', 150, [[230, '1時間 ＝ 60分。$2\\times60=120$、それに30分。'], [90, '$2\\times30+30$ ではないよ。1時間 ＝ 60分。'], [130, '1時間 ＝ 100分ではない。60分。']], ['$2\\times60=120$（分）。', '$120+30=150$（分）。'], '1時間 ＝ 60分。', '分')
  ];
}
function genKakudo() {
  return [
    NQ('kd-1', '三角形で、2つの角が 50° と 60° のとき、残りの角は？', 70, [[110, '$50+60=110$ は、2つの角の和。残りは、180−110。'], [130, '$180-50$ だけ引いているよ。2つとも引く。'], [10, '$60-50$ ではないよ。180 から、2つの角を引く。']], ['三角形の内角の和は 180°。', '$180-50-60=70$。'], '三角形の内角の和は 180°。', '°'),
    NQ('kd-2', '四角形の内角の和は？', 360, [[180, '180° は、三角形。四角形は、三角形2つ分。'], [270, '四角形は、三角形2つ分で 360°。'], [540, '540° は、五角形。']], ['四角形は、三角形2つに分けられる。', '$180\\times2=360$。'], '$n$ 角形の内角の和は $180\\times(n-2)$。', '°'),
    NQ('kd-3', '五角形の内角の和は？', 540, [[360, '360° は、四角形。五角形は、三角形3つ分。'], [450, '五角形は、三角形3つ分。$180\\times3$。'], [720, '720° は、六角形。']], ['$180\\times(5-2)=180\\times3=540$。'], '$n$ 角形の内角の和は $180\\times(n-2)$。', '°'),
    NQ('kd-4', '正六角形の、1つの内角は？', 120, [[60, '60° は、1つの外角。内角は、180−60。'], [108, '108° は、正五角形の内角。'], [135, '135° は、正八角形の内角。']], ['内角の和：$180\\times(6-2)=720$。', '1つ分：$720\\div6=120$。'], '正多角形の1つの内角 ＝ 内角の和 ÷ 角の数。', '°'),
    NQ('kd-5', '正八角形の、1つの外角は？', 45, [[135, '135° は、1つの内角。外角は、180−135。'], [60, '60° は、正六角形の外角。'], [90, '90° は、正方形の外角。']], ['外角の和は、いつも 360°。', '$360\\div8=45$。'], '多角形の外角の和は、いつも 360°。', '°'),
    NQ('kd-6', '2直線が交わっている。ある角が 65° のとき、その対頂角は？', 65, [[115, '115° は、となりあう角（180−65）。対頂角は、同じ大きさ。'], [25, '25° は、90−65。対頂角は、同じ大きさ。'], [295, '295° は、360−65。対頂角は、同じ大きさ。']], ['対頂角は、等しい。', '65°。'], '対頂角は等しい。となりあう角と合わせて 180°。', '°'),
    NQ('kd-7', '多角形の外角の和は？', 360, [[180, '180° は、三角形の内角の和。'], [720, '720° は、六角形の内角の和。外角の和は、いつも同じ。'], [540, '540° は、五角形の内角の和。外角の和は、いつも同じ。']], ['外角の和は、何角形でも、360°。'], '外角の和は、何角形でも 360°。', '°')
  ];
}
function genMenseki() {
  return [
    NQ('mk-1', '底辺8 cm、高さ5 cm の三角形の面積は？', 20, [[40, '÷2を忘れているよ。三角形は、底辺×高さ÷2。'], [13, '足し算になっているよ。底辺×高さ÷2。'], [80, '$8\\times5\\times2$ になっているよ。÷2。']], ['$8\\times5\\div2=20$。'], '三角形 ＝ 底辺 × 高さ ÷ 2。', 'cm²'),
    NQ('mk-2', '底辺7 cm、高さ4 cm の平行四辺形の面積は？', 28, [[14, '÷2は、いらないよ。平行四辺形は、底辺×高さ。'], [11, '足し算になっているよ。底辺×高さ。'], [56, '$7\\times4\\times2$ になっているよ。底辺×高さだけ。']], ['$7\\times4=28$。'], '平行四辺形 ＝ 底辺 × 高さ。', 'cm²'),
    NQ('mk-3', '上底3 cm、下底7 cm、高さ4 cm の台形の面積は？', 20, [[40, '÷2を忘れているよ。(上底＋下底)×高さ÷2。'], [10, '高さを、かけ忘れているよ。(3＋7) の後に、×4÷2。'], [21, '$3\\times7$ ではないよ。(上底＋下底)×高さ÷2。']], ['$(3+7)\\times4\\div2=20$。'], '台形 ＝ (上底 ＋ 下底) × 高さ ÷ 2。', 'cm²'),
    NQ('mk-4', '対角線が6 cm と10 cm のひし形の面積は？', 30, [[60, '÷2を忘れているよ。対角線×対角線÷2。'], [16, '足し算になっているよ。対角線×対角線÷2。'], [15, '÷2を、2回しているよ。÷2は1回。']], ['$6\\times10\\div2=30$。'], 'ひし形 ＝ 対角線 × 対角線 ÷ 2。', 'cm²'),
    NQ('mk-5', '底辺6 cm の三角形の面積が15 cm²。高さは？', 5, [[2.5, '$15\\div6$ だけでは、足りないよ。面積 ＝ 底辺×高さ÷2 なので、高さ ＝ 面積×2÷底辺。'], [7.5, '$15\\div2$ では、ないよ。面積×2÷底辺。'], [30, '$15\\times2$ だけでは、足りないよ。さらに、底辺6でわる。']], ['面積 ＝ 底辺×高さ÷2。', '高さ ＝ $15\\times2\\div6=5$。'], '三角形の高さ ＝ 面積 × 2 ÷ 底辺。', 'cm'),
    NQ('mk-6', '1辺6 cm の正方形の面積は？', 36, [[24, '24 は、まわりの長さ。面積は、$6\\times6$。'], [12, '足し算になっているよ。面積 ＝ 1辺×1辺。'], [18, '÷2 は、いらないよ。正方形は、1辺×1辺。']], ['$6\\times6=36$。'], '正方形 ＝ 1辺 × 1辺。', 'cm²')
  ];
}

/* ================= パートB: 円とおうぎ形 ================= */
const PU = (n, u) => '$' + PI(n) + '$ ' + u;
function genEn() {
  const out = [];
  const q = (id, p, t, ws, st, pt) => out.push(RAWQ(id, p, t, ws, st, pt));
  q('en-1', '半径6 cm の円の、円周の長さは？', PU(12, 'cm'), [[PU(6, 'cm'), '$\\pi r$ になっているよ。円周 ＝ $2\\times\\pi\\times$半径。'], [PU(36, 'cm'), '$\\pi r^2$ は、面積の式。円周は $2\\pi r$。'], [PU(24, 'cm'), '2を、かけすぎているよ。$2\\pi r=2\\times6\\pi=12\\pi$。']], ['円周 ＝ $2\\times\\pi\\times$半径。', '$2\\times\\pi\\times6=12\\pi$。'], '円周 ＝ 直径 × π ＝ 2 × π × 半径。');
  q('en-2', '直径10 cm の円の、円周の長さは？', PU(10, 'cm'), [[PU(20, 'cm'), '直径に、さらに2をかけているよ。円周 ＝ 直径×π。'], [PU(100, 'cm'), '$100\\pi$ は、直径を2乗している。円周 ＝ 直径×π。'], [PU(25, 'cm'), '25π は、半径5の円の面積。円周 ＝ 直径×π。']], ['円周 ＝ 直径 × π。', '$10\\times\\pi=10\\pi$。'], '円周 ＝ 直径 × π。');
  q('en-3', '半径4 cm の円の、面積は？', PU(16, 'cm²'), [[PU(8, 'cm²'), '8π は、円周（$2\\pi r$）。面積は、$\\pi r^2$。'], [PU(4, 'cm²'), '$\\pi r$ になっているよ。面積は、$\\pi\\times r\\times r$。'], [PU(64, 'cm²'), '半径を、3回かけているよ。$r\\times r$ の2回。']], ['面積 ＝ $\\pi\\times r\\times r$。', '$\\pi\\times4\\times4=16\\pi$。'], '円の面積 ＝ π × 半径 × 半径。');
  q('en-4', '直径12 cm の円の、面積は？', PU(36, 'cm²'), [[PU(144, 'cm²'), '直径を、2乗しているよ。半径6を使う。$\\pi\\times6\\times6$。'], [PU(12, 'cm²'), '12π は、円周。面積は、$\\pi r^2$。'], [PU(72, 'cm²'), '$\\pi\\times6\\times6\\times2$ ではないよ。$\\pi r^2$。']], ['半径 ＝ $12\\div2=6$。', '$\\pi\\times6\\times6=36\\pi$。'], '面積では、直径ではなく、半径を使う。');
  out.push(NQ('en-5', '円周が $18\\pi$ cm の円の、半径は？', 9, [[18, '18 は、直径。半径は、その半分。'], [36, '$18\\times2$ としているよ。円周 ＝ 直径×π なので、直径 ＝ 18。'], [3, '$18\\div6$ ではないよ。円周 ＝ 直径×π。']], ['円周 ＝ 直径 × π。直径 ＝ 18。', '半径 ＝ $18\\div2=9$。'], '円周から半径：円周÷π÷2。', 'cm'));
  out.push(NQ('en-6', '面積が $25\\pi$ cm² の円の、半径は？', 5, [[25, '25 は、半径×半径。半径は、2乗して25になる数。'], [12.5, '25 を2でわっているよ。$r\\times r=25$。'], [10, '10 は、直径。半径は、その半分。']], ['$\\pi\\times r\\times r=25\\pi$ より、$r\\times r=25$。', '$5\\times5=25$。半径は 5。'], '面積から半径：$r\\times r$ ＝ 面積÷π。', 'cm'));
  return out;
}
function genOugi() {
  const out = [];
  const q = (id, p, t, ws, st, pt) => out.push(RAWQ(id, p, t, ws, st, pt));
  q('og-1', '半径6 cm、中心角60°のおうぎ形の、弧の長さは？', PU(2, 'cm'), [[PU(12, 'cm'), '12π は、円周ぜんたい。中心角に合わせて、$\\dfrac{60}{360}$ をかける。'], [PU(6, 'cm'), '中心角 60° なので、円周の $\\dfrac{1}{6}$。$12\\pi\\div6$。'], [PU(1, 'cm'), '円周 12π の $\\dfrac{1}{6}$ は、2π。']], ['円周：$2\\pi\\times6=12\\pi$。', '$\\dfrac{60}{360}=\\dfrac{1}{6}$ をかける。$12\\pi\\times\\dfrac{1}{6}=2\\pi$。'], '弧の長さ ＝ 円周 × 中心角/360。');
  q('og-2', '半径9 cm、中心角120°のおうぎ形の、弧の長さは？', PU(6, 'cm'), [[PU(18, 'cm'), '18π は、円周ぜんたい。中心角に合わせて、$\\dfrac{120}{360}$ をかける。'], [PU(3, 'cm'), '$\\dfrac{120}{360}=\\dfrac{1}{3}$。円周 18π の $\\dfrac{1}{3}$。'], [PU(12, 'cm'), '12π は、どこからも出てこない。円周 18π の $\\dfrac{1}{3}$。']], ['円周：$2\\pi\\times9=18\\pi$。', '$18\\pi\\times\\dfrac{120}{360}=6\\pi$。'], '弧の長さ ＝ 円周 × 中心角/360。');
  q('og-3', '半径12 cm、中心角90°のおうぎ形の、弧の長さは？', PU(6, 'cm'), [[PU(24, 'cm'), '24π は、円周ぜんたい。中心角 90° は、円の $\\dfrac{1}{4}$。'], [PU(12, 'cm'), '円周 24π の $\\dfrac{1}{2}$ になっているよ。90° は $\\dfrac{1}{4}$。'], [PU(3, 'cm'), '円周 24π の $\\dfrac{1}{8}$ になっているよ。90° は $\\dfrac{1}{4}$。']], ['円周：$2\\pi\\times12=24\\pi$。', '$24\\pi\\times\\dfrac{90}{360}=6\\pi$。'], '弧の長さ ＝ 円周 × 中心角/360。');
  q('og-4', '半径6 cm、中心角60°のおうぎ形の、面積は？', PU(6, 'cm²'), [[PU(36, 'cm²'), '36π は、円ぜんたいの面積。中心角に合わせて、$\\dfrac{1}{6}$ をかける。'], [PU(2, 'cm²'), '2π は、弧の長さ。面積は、円の面積の $\\dfrac{1}{6}$。'], [PU(12, 'cm²'), '12π は、円周。面積は、円の面積 36π の $\\dfrac{1}{6}$。']], ['円の面積：$\\pi\\times6\\times6=36\\pi$。', '$36\\pi\\times\\dfrac{60}{360}=6\\pi$。'], 'おうぎ形の面積 ＝ 円の面積 × 中心角/360。');
  q('og-5', '半径3 cm、中心角120°のおうぎ形の、面積は？', PU(3, 'cm²'), [[PU(9, 'cm²'), '9π は、円ぜんたいの面積。中心角 120° は、円の $\\dfrac{1}{3}$。'], [PU(2, 'cm²'), '2π は、弧の長さ。面積は、円の面積の $\\dfrac{1}{3}$。'], [PU(6, 'cm²'), '6π は、円周。面積は、円の面積 9π の $\\dfrac{1}{3}$。']], ['円の面積：$\\pi\\times3\\times3=9\\pi$。', '$9\\pi\\times\\dfrac{120}{360}=3\\pi$。'], 'おうぎ形の面積 ＝ 円の面積 × 中心角/360。');
  out.push(NQ('og-6', '半径6 cm で、弧の長さが $4\\pi$ cm のおうぎ形の、中心角は？', 120, [[60, '60° だと、弧は $2\\pi$。弧 $4\\pi$ は、円周 $12\\pi$ の $\\dfrac{1}{3}$。'], [240, '240° は、$\\dfrac{2}{3}$。$4\\pi$ は、円周 $12\\pi$ の $\\dfrac{1}{3}$。'], [90, '90° だと、弧は $3\\pi$。$4\\pi$ は、円周 $12\\pi$ の $\\dfrac{1}{3}$。']], ['円周：$2\\pi\\times6=12\\pi$。', '$4\\pi\\div12\\pi=\\dfrac{1}{3}$。$360\\times\\dfrac{1}{3}=120$。'], '中心角 ＝ 360° × 弧 ÷ 円周。', '°'));
  q('og-7', '半径5 cm で、弧の長さが $4\\pi$ cm のおうぎ形の、面積は？', PU(10, 'cm²'), [[PU(20, 'cm²'), '÷2を、忘れているよ。面積 ＝ $\\dfrac{1}{2}\\times$弧×半径。'], [PU(5, 'cm²'), '$4\\pi\\times5\\div4$ ではないよ。面積 ＝ $\\dfrac{1}{2}\\times4\\pi\\times5$。'], [PU(2, 'cm²'), '$4\\pi\\div2$ だけでは、足りないよ。半径もかける。']], ['面積 ＝ $\\dfrac{1}{2}\\times$ 弧 × 半径。', '$\\dfrac{1}{2}\\times4\\pi\\times5=10\\pi$。'], 'おうぎ形の面積 ＝ 1/2 × 弧の長さ × 半径。');
  return out;
}

/* ================= パートC: 作図と移動 ================= */

/* ---------- 作図の図 ---------- */
const S_ = s => ' style="' + s + '"';
const svgW = (h, inner) => '<svg viewBox="0 0 260 ' + h + '" role="img" aria-label="作図の図"' + S_('width:100%;max-width:320px;height:auto;display:block;margin:8px auto') + '>' + inner + '</svg>';
const ln = (x1, y1, x2, y2, c, w, dash) => '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '"' + S_('stroke:var(' + c + ');stroke-width:' + (w || 2) + ';stroke-linecap:round' + (dash ? ';stroke-dasharray:5 4' : '')) + '/>';
const dot = (x, y, l, dx, dy) => '<circle cx="' + x + '" cy="' + y + '" r="3.5"' + S_('fill:var(--fg)') + '/>' + (l ? '<text x="' + (x + (dx || 7)) + '" y="' + (y + (dy || -7)) + '"' + S_('font:700 14px sans-serif;fill:var(--fg)') + '>' + l + '</text>' : '');
const arcP = (cx, cy, r, a1, a2, c) => {                        // 角度は数学の向き（反時計まわり、度）
  const p = a => [(cx + r * Math.cos(a * Math.PI / 180)).toFixed(1), (cy - r * Math.sin(a * Math.PI / 180)).toFixed(1)];
  const s = p(a1), e = p(a2);
  return '<path d="M' + s.join(',') + ' A' + r + ' ' + r + ' 0 0 0 ' + e.join(',') + '" fill="none"' + S_('stroke:var(' + (c || '--neg') + ');stroke-width:1.8') + '/>';
};
function figBisect(stage) {          // 垂直二等分線
  const A = [40, 110], B = [200, 110], r = 100;
  let s = ln(A[0], A[1], B[0], B[1], '--fg', 2.5);
  if (stage >= 1) s += arcP(A[0], A[1], r, -55, 55) + arcP(B[0], B[1], r, 125, 235);
  if (stage >= 2) s += ln(120, 25, 120, 195, '--pos', 2.5) + dot(120, 50, 'P', 7, -4) + dot(120, 170, 'Q', 7, 14) + dot(120, 110, 'M', 7, -6);
  return { type: 'svg', html: svgW(220, s + dot(A[0], A[1], 'A', -16, 18) + dot(B[0], B[1], 'B', 6, 18)) };
}
function figAngle(stage) {           // 角の二等分線
  const O = [30, 180], L = 210, a = 60;
  const ex = Math.cos(a * Math.PI / 180) * L, ey = Math.sin(a * Math.PI / 180) * L;
  let s = ln(O[0], O[1], O[0] + L, O[1], '--fg', 2.5) + ln(O[0], O[1], O[0] + ex, O[1] - ey, '--fg', 2.5);
  const r = 70, P = [O[0] + r, O[1]], Q = [O[0] + r * Math.cos(a * Math.PI / 180), O[1] - r * Math.sin(a * Math.PI / 180)];
  if (stage >= 1) s += arcP(O[0], O[1], r, -8, a + 8) + dot(P[0], P[1], 'P', 2, 16) + dot(Q[0].toFixed(1) * 1, Q[1].toFixed(1) * 1, 'Q', -18, 6);
  const R = [O[0] + 2 * r * Math.cos(a / 2 * Math.PI / 180) * Math.cos(a / 2 * Math.PI / 180) * 0 + 0, 0];
  const d = 90;                                                       // 二等分線の上で、Oから d の点R
  const Rp = [O[0] + d * Math.cos(30 * Math.PI / 180) * 1.0, O[1] - d * Math.sin(30 * Math.PI / 180)];
  if (stage >= 1) { const rr = 45; s += arcP(P[0], P[1], rr, 55, 105) + arcP(Q[0], Q[1], rr, -45, 3); }
  if (stage >= 2) s += ln(O[0], O[1], O[0] + 190 * Math.cos(30 * Math.PI / 180), O[1] - 190 * Math.sin(30 * Math.PI / 180), '--pos', 2.5);
  return { type: 'svg', html: svgW(200, s + dot(O[0], O[1], 'O', -16, 16)) };
}
function figPerp(stage) {            // 垂線
  const y = 170, P = [120, 80];
  let s = ln(10, y, 250, y, '--fg', 2.5) + '<text x="238" y="' + (y - 8) + '"' + S_('font:700 14px sans-serif;fill:var(--fg)') + '>ℓ</text>' + dot(P[0], P[1], 'P', 7, -5);
  const dx = Math.sqrt(120 * 120 - 90 * 90);
  if (stage >= 1) s += '<path d="M' + (P[0] - dx - 6) + ',' + (y - 4) + ' A120 120 0 0 0 ' + (P[0] + dx + 6) + ',' + (y - 4) + '" fill="none"' + S_('stroke:var(--neg);stroke-width:1.8') + '/>' + dot(P[0] - dx, y, 'A', -16, 18) + dot(P[0] + dx, y, 'B', 6, 18);
  if (stage >= 1) { s += arcP(P[0] - dx, y, 100, -80, -30) + arcP(P[0] + dx, y, 100, 210, 260); }
  if (stage >= 2) s += ln(120, 40, 120, 262, '--pos', 2.5) + dot(120, y, 'H', 7, -6);
  return { type: 'svg', html: svgW(270, s) };
}
function figTangent() {              // 円の接線
  const O = [130, 100], r = 70, A = [130, 170];
  const s = '<circle cx="130" cy="100" r="70" fill="none"' + S_('stroke:var(--fg);stroke-width:2.5') + '/>' + ln(130, 100, 130, 170, '--neg', 2.5) + ln(40, 170, 220, 170, '--pos', 2.5) + dot(130, 100, 'O', -18, 4) + dot(130, 170, 'A', 8, 18) + '<path d="M130,158 L142,158 L142,170" fill="none"' + S_('stroke:var(--fg);stroke-width:1.5') + '/><text x="205" y="162"' + S_('font:700 14px sans-serif;fill:var(--fg)') + '>ℓ</text>';
  return { type: 'svg', html: svgW(200, s) };
}

function genSakuzu() {
  return [
    RQ('sz-1', '線分ABの垂直二等分線を作図する。はじめに、することは？', 'AとBを中心に、同じ半径の円（弧）を、上下にかく', [['分度器で、ABに垂直な線を引く', '作図では、分度器やものさしの目もりは使わない。コンパスと定規だけ。'], ['ABの真ん中を、目分量で決める', '作図は、目分量ではなく、正確に決める。コンパスで交点を作る。'], ['ABの長さをはかって、半分の点に印をつける', '作図では、目もりを使わない。コンパスで、中点を出す。']], ['AとBを中心に、同じ半径の円をかく。', '2つの円の交点を結ぶ。それが、垂直二等分線。'], '作図は、コンパスと定規だけを使う。', {fig: figBisect(0), figAfter: figBisect(2)}),
    RQ('sz-2', '線分ABの垂直二等分線の上の点について、正しいのは？', '点Aと点Bから、等しい距離にある', [['点Aに、近い', '垂直二等分線の上の点は、AからもBからも、同じ距離。'], ['点Bに、近い', '垂直二等分線の上の点は、AからもBからも、同じ距離。'], ['線分ABの上にある', '垂直二等分線は、ABと垂直に交わる。線分ABの上の点は、中点だけ。']], ['垂直二等分線は、線分の中点を通る。', '線上のどの点も、AとBから等しい距離。'], '垂直二等分線 ＝ 2点から等しい距離にある点の集まり。', {fig: figBisect(2), figAfter: figBisect(2)}),
    RQ('sz-3', '角の二等分線の上の点について、正しいのは？', '角をつくる2つの辺から、等しい距離にある', [['角の頂点から、等しい距離にある', '距離が等しいのは、頂点ではなく、2つの辺。'], ['角の一方の辺の上にある', '二等分線は、2つの辺の間を、通る。'], ['角と同じ大きさ（角度）になる', '二等分線は、角を、半分に分ける。']], ['角の二等分線は、角を半分に分ける。', '線上の点は、2辺から等しい距離。'], '角の二等分線 ＝ 角の2辺から等しい距離にある点の集まり。', {fig: figAngle(0), figAfter: figAngle(2)}),
    RQ('sz-4', '点Pを通り、直線ℓに垂直な直線を作図する。はじめに、することは？', 'Pを中心に、ℓと2点で交わる円をかく', [['Pから、ℓに分度器で90°を取る', '分度器は、作図では使わない。'], ['ℓ の上に、目分量で点を取る', '作図は、目分量ではなく、コンパスで決める。'], ['ℓ を、まっすぐ、のばす', 'のばしても、垂線は決まらない。まず、Pを中心に円をかく。']], ['Pを中心に、円をかいて、ℓとの交点を2つ取る。', 'その2点を中心に、同じ半径の円をかいて、交点とPを結ぶ。'], '垂線の作図は、「円→交点→円→結ぶ」。', {fig: figPerp(0), figAfter: figPerp(2)}),
    RQ('sz-5', '2点A、Bから、等しい距離にある点の集まりは？', '線分ABの垂直二等分線', [['線分ABそのもの', '線分AB の上の点は、AからもBからも、同じ距離とは限らない。'], ['Aを通る、ABに垂直な線', 'Aを通る垂線は、Bより、Aに近い点ばかり。'], ['Bを中心とする円', '円の上の点は、Bから等しい距離。Aからは、ちがう。']], ['2点から等しい距離 ＝ 垂直二等分線。'], '垂直二等分線 ＝ 2点から等しい距離にある点の集まり。'),
    RQ('sz-6', '円Oの接線ℓが、円と点Aで接している。OAと直線ℓの関係は？', '垂直に交わる', [['平行', '接点を通る半径は、接線と垂直。平行ではない。'], ['45°で交わる', '接点を通る半径は、接線と、直角（90°）に交わる。'], ['重なる', '半径OAと接線ℓは、重ならない。垂直に交わる。']], ['円の接線は、接点を通る半径に、垂直。'], '円の接線は、接点を通る半径に垂直。', {fig: figTangent(), figAfter: figTangent()})
  ];
}
function genIdo() {
  const out = [];
  const mv = (id, p, P, truth, wrongs, why, steps, point) => {
    const o = RAWQ(id, p, '$' + ct(truth[0], truth[1]) + '$', wrongs.map(([x, y, w]) => ['$' + ct(x, y) + '$', w]), steps, point);
    o.fig = graph({ pts: [{ x: P[0], y: P[1], l: 'P' }] });
    out.push(o);
  };
  mv('id-1', '点P(2, 1) を、$x$ 軸の正の向きに3だけ平行移動した点は？', [2, 1], [5, 1], [[2, 4, '$y$ 座標が変わっているよ。$x$ 軸の向きに動くので、$x$ 座標が変わる。'], [-1, 1, '向きが逆だよ。正の向き（右）に動くので、$2+3$。'], [5, 4, '$x$ と $y$ の両方を動かしているよ。$x$ 軸の向きだけ。']], '', ['$x$ 座標に 3 を足す。$2+3=5$。', '$y$ 座標は、そのまま。'], '平行移動：その向きの座標だけが変わる。');
  mv('id-2', '点P(3, 2) を、$x$ 軸について対称移動した点は？', [3, 2], [3, -2], [[-3, 2, '$y$ 軸について対称移動した点。$x$ 軸なら、$y$ 座標の符号が変わる。'], [-3, -2, '原点について対称移動（点対称）した点。$x$ 軸なら、$y$ 座標だけ。'], [2, 3, '$x$ と $y$ を入れかえた点（直線 $y=x$ について対称）。']], '', ['$x$ 軸について対称：$x$ 軸をはさんで、反対側。', '$y$ 座標の符号が変わる。$(3,-2)$。'], '$x$ 軸について対称：$y$ の符号が変わる。');
  mv('id-3', '点P(3, 2) を、$y$ 軸について対称移動した点は？', [3, 2], [-3, 2], [[3, -2, '$x$ 軸について対称移動した点。$y$ 軸なら、$x$ 座標の符号が変わる。'], [-3, -2, '原点について対称移動（点対称）した点。$y$ 軸なら、$x$ 座標だけ。'], [2, 3, '$x$ と $y$ を入れかえた点。$y$ 軸について対称ではない。']], '', ['$y$ 軸について対称：$y$ 軸をはさんで、反対側。', '$x$ 座標の符号が変わる。$(-3,2)$。'], '$y$ 軸について対称：$x$ の符号が変わる。');
  mv('id-4', '点P(3, 2) を、原点について点対称に移動した点は？', [3, 2], [-3, -2], [[-3, 2, '$y$ 軸について対称移動した点。原点なら、両方の符号が変わる。'], [3, -2, '$x$ 軸について対称移動した点。原点なら、両方の符号が変わる。'], [-2, -3, '$x$ と $y$ を入れかえて、符号まで変えているよ。']], '', ['原点について対称：原点を通って、反対側。', '$x$ も $y$ も、符号が変わる。$(-3,-2)$。'], '原点について点対称：$x$、$y$ の両方の符号が変わる。（180°回転）');
  mv('id-5', '点P(3, 2) を、原点を中心に、反時計まわりに90°回転した点は？', [3, 2], [-2, 3], [[2, -3, '時計まわりに90°回転した点。反時計まわりは、左上へ。'], [-3, -2, '180°回転した点。90°は、半分。'], [2, 3, '回転していないよ。$x$ と $y$ が逆になっているだけ。']], '', ['反時計まわりに90°：右（$x$ 軸の正）→ 上（$y$ 軸の正）の向き。', '$(x,y)\\to(-y,x)$。$(3,2)\\to(-2,3)$。'], '反時計まわりに90°回転：$(x,y)\\to(-y,x)$。');
  mv('id-6', '点P(1, 2) を、$y$ 軸の負の向きに4だけ平行移動した点は？', [1, 2], [1, -2], [[1, 6, '向きが逆だよ。負の向き（下）に動くので、$2-4$。'], [-3, 2, '$x$ 座標が変わっているよ。$y$ 軸の向きに動くので、$y$ 座標が変わる。'], [5, 2, '$x$ 座標が変わっているよ。$y$ 軸の向きに動くので、$y$ 座標が変わる。']], '', ['$y$ 座標から 4 を引く。$2-4=-2$。', '$x$ 座標は、そのまま。'], '平行移動：その向きの座標だけが変わる。');
  out.push(RQ('id-7', '図形を平行移動したとき、対応する点を結ぶ線分は？', '平行で、長さが等しい', [['たがいに、交わる', '平行移動では、対応する点を結ぶ線分は、すべて平行。'], ['長さが、バラバラ', '平行移動では、どの点も同じだけ動く。長さが等しい。'], ['ある点で、垂直に交わる', '垂直ではなく、平行。']], ['平行移動は、すべての点が、同じ向きに、同じ距離だけ動く。'], '平行移動：対応する点を結ぶ線分は、平行で等しい。'));
  return out;
}

/* ---------- 組み立て ---------- */
const RT = rows => '<table class="rtab">' + rows.map(r => '<tr>' + r.map(c => '<td>' + c + '</td>').join('') + '</tr>').join('') + '</table>';
const I = {
  tn: '長さ・重さ・かさ・時間の<b>単位</b>を、しっかり直せるようにする。<br>1 m ＝ 100 cm、1 km ＝ 1000 m、1 kg ＝ 1000 g、1 L ＝ 1000 mL。<br>小さい単位に直すと数は<b>大きく</b>、大きい単位に直すと数は<b>小さく</b>なる。面積は、長さの換算を<b>2回</b>かける。',
  kd: '<b>三角形の内角の和は 180°</b>。$n$ 角形の内角の和は $180\\times(n-2)$。<br><b>外角の和は、何角形でも 360°</b>。<br><b>対頂角</b>は等しい。正多角形の1つの角は、和を角の数でわる。',
  mk: '<b>三角形</b> ＝ 底辺×高さ÷2<br><b>平行四辺形</b> ＝ 底辺×高さ<br><b>台形</b> ＝ (上底＋下底)×高さ÷2<br><b>ひし形</b> ＝ 対角線×対角線÷2',
  en: '円周率を $\\pi$ と書く（約3.14）。<br><b>円周</b> ＝ 直径×$\\pi$ ＝ $2\\pi r$<br><b>面積</b> ＝ $\\pi r^2$（$r$ は<b>半径</b>）<br>答えは、$\\pi$ をつけたまま書く。$12\\pi$ cm のように。',
  og: '<b>おうぎ形</b>は、円の一部。中心角が $a°$ なら、円の $\\dfrac{a}{360}$。<br><b>弧の長さ</b> ＝ 円周 × $\\dfrac{a}{360}$<br><b>面積</b> ＝ 円の面積 × $\\dfrac{a}{360}$<br>弧の長さがわかっているときは、面積 ＝ $\\dfrac{1}{2}$×弧×半径。',
  sz: '<b>作図</b>は、<b>コンパスと定規だけ</b>で図をかくこと。分度器や目もりは使わない。<br><b>① 垂直二等分線</b>：A、Bを中心に同じ半径の円（弧）をかき、2つの交点P、Qを結ぶ。' + figBisect(2).html + '<b>② 角の二等分線</b>：Oを中心に弧をかいてP、Qを取り、P、Qから同じ半径の弧をかく。その交点とOを結ぶ。' + figAngle(2).html + '<b>③ 垂線</b>：Pを中心に弧をかいて直線ℓ上にA、Bを取り、A、Bから同じ半径の弧をかく。その交点とPを結ぶ。' + figPerp(2).html + '円の接線は、接点を通る半径に垂直。',
  id: '図形を動かす3つの方法。<br>・<b>平行移動</b>：同じ向きに、同じだけずらす<br>・<b>回転移動</b>：ある点を中心に、回す<br>・<b>対称移動</b>：直線を折り目に、折り返す<br>座標では、$x$ 軸対称は $y$ の符号、$y$ 軸対称は $x$ の符号、原点対称は両方の符号が変わる。'
};
const ABOUT = {
  zukei: [
    { p: '<b>三角形の内角の和は 180°</b>。ここから、すべての角度が出せる。' },
    { p: RT([['$n$ 角形の内角の和', '→', '$180\\times(n-2)$'], ['外角の和', '→', '360°（いつも）'], ['三角形の面積', '→', '底辺×高さ÷2']]) },
    { cap: '公式は、図とセットで覚える。' }
  ],
  en: [
    { p: '<b>円</b>は $\\pi$（円周率）を使う。<b>おうぎ形</b>は、円の一部。' },
    { p: RT([['円周', '→', '$2\\pi r$'], ['円の面積', '→', '$\\pi r^2$'], ['おうぎ形', '→', '円 × 中心角/360']]) },
    { cap: '答えは、$\\pi$ をつけたまま書く。' }
  ],
  sakuzu: [
    { p: '<b>作図</b>はコンパスと定規だけ。<b>移動</b>は、図形の位置を変えること。' },
    { p: RT([['垂直二等分線', '→', '2点から等しい距離'], ['角の二等分線', '→', '2辺から等しい距離'], ['対称移動', '→', '折り返す']]) },
    { cap: '定規の目もりと、分度器は使わない。' }
  ]
};
const PARTS = [
  {
    id: 'zukei', title: '図形のおさらい', sub: '単位・角度・面積', about: ABOUT.zukei, aboutTitle: 'まず見てみよう：図形の公式', aboutSub: '角度と面積',
    steps: [
      { id: 'zukei-1', title: '単位の換算', sub: 'm・cm・kg・L', intro: I.tn, qs: genTani() },
      { id: 'zukei-2', title: '角度と内角の和', sub: '180° が基本', intro: I.kd, qs: genKakudo() },
      { id: 'zukei-3', title: '面積', sub: '三角形・台形・ひし形', intro: I.mk, qs: genMenseki() }
    ]
  },
  {
    id: 'en', title: '円とおうぎ形', sub: '円周・面積・弧', about: ABOUT.en, aboutTitle: 'まず見てみよう：円', aboutSub: 'π を使う',
    steps: [
      { id: 'enst-1', title: '円の円周と面積', sub: '2πr と πr²', intro: I.en, qs: genEn() },
      { id: 'enst-2', title: 'おうぎ形', sub: '弧の長さと面積', intro: I.og, qs: genOugi() }
    ]
  },
  {
    id: 'sakuzu', title: '作図と移動', sub: '垂直二等分線・対称', about: ABOUT.sakuzu, aboutTitle: 'まず見てみよう：作図と移動', aboutSub: 'コンパスと定規',
    steps: [
      { id: 'sakuzu-1', title: '作図', sub: 'コンパスと定規', intro: I.sz, qs: genSakuzu() },
      { id: 'sakuzu-2', title: '図形の移動', sub: '平行・対称・回転', intro: I.id, qs: genIdo() }
    ]
  }
];
const ruby = o => typeof o === 'string' ? o.replace(/弧/g, '<ruby>弧<rt>こ</rt></ruby>').replace(/垂線/g, '<ruby>垂線<rt>すいせん</rt></ruby>').replace(/接線/g, '<ruby>接線<rt>せっせん</rt></ruby>')
  : Array.isArray(o) ? o.map(ruby) : (o && typeof o === 'object') ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, (k === 'expr' || k === 'id' || k === 'html') ? v : ruby(v)])) : o;
const out = '// 自動生成（node gen5.js）。手で直すときは gen5.js を直す。\nconst PARTS = ' + JSON.stringify(ruby(PARTS)) + ';\nif (typeof module !== \'undefined\') module.exports = PARTS;\n';
fs.writeFileSync(path.join(__dirname, 'src/data.js'), out);
let n = 0; PARTS.forEach(P => P.steps.forEach(s => { n += s.qs.length; }));
console.log('src/data.js を作成：' + n + '問、' + (out.length / 1024).toFixed(0) + 'KB');
