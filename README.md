# 中学数学 レベル5（平面図形）

公開URL: https://chugaku-suugaku5.senta1111.workers.dev/

- 配信するのは `public/index.html` の1枚だけ（KaTeXの式表示も中に入っている）。
- 内容: 図形のおさらい / 円とおうぎ形 / 作図と移動。全7ステップ・46問。作図の図は SVG を自動で描いている。
- 問題を直す・足すとき: `tools/gen5.js` を直す。
  1. `cd tools`
  2. `node gen5.js`（`src/data.js` を作る）
  3. `node check.js`（ALL OK が出ること）
  4. `node build.js --repo`（`tools/public/index.html` を作る）→ `public/index.html` に置きかえる
