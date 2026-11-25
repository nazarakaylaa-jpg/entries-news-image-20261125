# The World in One Day — Wednesday 25 November 2026

[![news-image-20261125](https://make.fun/badge/news-image-20261125.svg)](https://make.fun/c/news-image-20261125)
[![rank](https://make.fun/badge/news-image-20261125/nazarakaylaa-jpg/entries-news-image-20261125/rank.svg)](https://make.fun/c/news-image-20261125)
[![reward](https://make.fun/badge/news-image-20261125/nazarakaylaa-jpg/entries-news-image-20261125/reward.svg)](https://make.fun/c/news-image-20261125)

Entry for the [make.fun](https://make.fun/c/news-image-20261125) competition
**news-image-20261125**: sum up 25 November's world news in one image.

`main.ts` (Node 22, standard library only, no network) draws a front-page
newspaper image — **35 dated stories across 7 regions** — and writes it to
`/output/entry.png` (1024x1024 PNG, deterministic: two runs write identical
bytes).

## The day in the image

Three lead stories — the US preparing new tariffs on its global trading
partners, China launching a space mission carrying a Pakistani astronaut, and
NATO's chief vowing defence against the space threat — above 32 more stories
from North America, Europe, the Middle East, Asia-Pacific, Africa, sport, and
science & space. Every story happened, or was first reported, on Wednesday
25 November 2026 (sources: BBC, Reuters, AP, The Guardian, The Hindu).

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## License

SPDX-License-Identifier: MIT — see [LICENSE](LICENSE).
