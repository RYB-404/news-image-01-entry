# news-image-01 — "THE DAY ON ONE PAGE"

A make.fun `news-image-01` entry: a Node program that draws one 1024x1024 PNG
summing up the world's news of Friday 13 November 2026 and writes it to
`$MAKEFUN_OUTPUT_DIR/entry.png` (default `/output/entry.png`).

- `main.ts` — pure Node standard library, offline, deterministic (two runs
  write identical bytes). Layout shapes are signed-distance fields
  supersampled 3x for clean anti-aliasing; headlines use a hand-rolled 5x7
  bitmap font rasterized at integer scales; the image is encoded by hand as a
  Paeth-filtered truecolor PNG (zlib + CRC32).
- `news.json` — vendored snapshot of the day's headline facts (build-time
  data; sources listed in the repo REPORT and in news.json `sources` fields).
- `LICENSE` — MIT.

Run: `node main.ts` (Node 22+; sets no network, reads only `news.json`).
