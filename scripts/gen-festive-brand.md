# How the festive derivatives were made

`public/brand/festive/logo-mark-festive-master-1254.png` is the supplied festive mark: 1254×1254,
straight alpha, the ordinary ring palette with snow caps, gold sparkle, silver snowflakes and a
holly-and-bow at the lower right.

Three files are derived from it. Every one keeps the geometry of the file it stands in for, so no
layout moves and nothing is recentred:

| File | Size | How |
|---|---|---|
| `public/brand/festive/logo-mark-festive.png` | 128×128, alpha | Lanczos reduction, then a light unsharp mask (see below). The mark's own ring span is 76.5% of its canvas against the everyday mark's 78.0%, and the two centres agree within 1.2%, so no trim or re-centre was needed. 128px covers the largest use (40 CSS px) at 3.2×. |
| `assets/brand/apple-icon-festive.png` | 180×180, opaque | Cream `#F4F3F0` ground, mark reduced and sharpened the same way, scaled to a 102px ring span centred at (89, 89.5) — measured off `apple-icon.png`, so the two icons sit identically in the dock. |
| `assets/brand/opengraph-image-festive.png` | 1200×630, opaque | `opengraph-image.png` with the ring area (88,142)–(434,486) refilled cream and the festive mark laid in at a 313px ring span centred at (260.5, 313.5), matching the original's ring exactly. Wordmark, strapline, URL and colour bar are the original pixels. |

Reproduce with Pillow:

```python
from PIL import Image, ImageDraw, ImageFilter
src = Image.open("public/brand/festive/logo-mark-festive-master-1254.png").convert("RGBA")
RB = (158, 138, 1118, 1111)          # saturated ring extent in the master
rw = RB[2] - RB[0]; rcx = (RB[0] + RB[2]) / 2; rcy = (RB[1] + RB[3]) / 2
CREAM = (244, 243, 240, 255)

SHARP = ImageFilter.UnsharpMask(radius=1.0, percent=60, threshold=2)
shrink = lambda size: src.resize(size, Image.LANCZOS).filter(SHARP)

def placed(canvas, ring_w, centre, bg=None):
    k = ring_w / rw
    m = shrink((round(src.width * k), round(src.height * k)))
    base = Image.new("RGBA", canvas, bg or (0, 0, 0, 0))
    base.alpha_composite(m, (round(centre[0] - rcx * k), round(centre[1] - rcy * k)))
    return base

shrink((128, 128)).save("public/brand/festive/logo-mark-festive.png", optimize=True)
placed((180, 180), 102, (89, 89.5), CREAM).convert("RGB").save("assets/brand/apple-icon-festive.png", optimize=True)

og = Image.open("assets/brand/opengraph-image.png").convert("RGBA")
ImageDraw.Draw(og).rectangle([88, 142, 434, 486], fill=CREAM)
og.alpha_composite(placed(og.size, 313, (260.5, 313.5)))
og.convert("RGB").save("assets/brand/opengraph-image-festive.png", optimize=True)
```

## Why there is a sharpening pass

The supplied mark is painted, not drawn: soft edges, a glow, and snow that shades into the rings. A
plain Lanczos reduction to 40px left it visibly woollier than the everyday mark beside it in the
header. A light unsharp mask (radius 1.0, 60%, threshold 2) restores the edge contrast the reduction
costs and brings it back to the same weight as the mark it stands in for. It costs 3.5KB.

## Why these are full-colour and not quantised

A 256-colour octree quantisation took the 128px mark from 37KB to 9KB and threw away the warm gold
halo with it — on the navy footer the quantised mark read as flat and cold. It is kept unquantised.
At 37KB it is still a fifteenth of `logo-mark-keyed.png` (572KB), which the header serves `unoptimized`
today for the same 40px slot, so the festive header is lighter than the everyday one.

## What was deliberately left alone

- **The favicon** (`app/icon.png`). A tab icon is drawn at 16–32px, where the holly reduces to a dark
  red-green smudge against the rings and the gold disappears. It is also the asset browsers cache
  hardest, so the automatic hand-back on 6 January is least reliable there.
- **The page watermark** (`app/globals.css`, `body::before/::after`) at 5–8% opacity, and the ring
  watermark on social cards at 8%. Snow and gold do not survive those opacities.
- **The mobile app's own icons.** Those ship inside the iOS and Android binaries and cannot change
  without a store release. See the completion report.
