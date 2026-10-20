"""Give every product photo the same clean white studio background.

75 of the 102 catalogue images were exported from transparent PNGs to JPEG,
which flattened the transparency to solid black (some fully, some as black
bars either side of a white square). On a storefront that reads as broken
photography, and it made product cards look inconsistent next to the 27
images that were already on white.

This flood-fills the near-black region *connected to the image border*
(i.e. the background, never a dark garment in the middle of the frame) and
paints it white, then pads every image to a square. Originals in
data/products/ are never modified; cleaned copies go to data/products_clean/,
which db.py serves in preference when it exists.

Run from backend:  .venv/bin/python scripts/clean_product_images.py
"""

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

DATA_DIR = Path(__file__).resolve().parents[2] / "data"
SRC_DIR = DATA_DIR / "products"
OUT_DIR = DATA_DIR / "products_clean"

# A pixel counts as "background black" if every channel is at or below this.
# Navy garments sit around (20, 30, 60), so the blue channel keeps them safe.
BLACK_MAX = 12
SEED_STEP = 8


def clean(path: Path) -> Image.Image:
    img = Image.open(path).convert("RGB")
    arr = np.asarray(img).astype(np.int16)
    w, h = img.size

    near_black = (arr.max(axis=2) <= BLACK_MAX).astype(np.uint8) * 255
    mask = Image.fromarray(near_black).copy()  # copy: fromarray can share a read-only buffer

    # Flood from every near-black point along the border so only background
    # connected to the edge is selected, not dark details inside the garment.
    seeds = (
        [(x, 0) for x in range(0, w, SEED_STEP)]
        + [(x, h - 1) for x in range(0, w, SEED_STEP)]
        + [(0, y) for y in range(0, h, SEED_STEP)]
        + [(w - 1, y) for y in range(0, h, SEED_STEP)]
    )
    for seed in seeds:
        if mask.getpixel(seed) == 255:
            ImageDraw.floodfill(mask, seed, 128)

    background = Image.fromarray((np.asarray(mask) == 128).astype(np.uint8) * 255)
    # Grow by a pixel to swallow the dark JPEG halo around the garment edge.
    background = background.filter(ImageFilter.MaxFilter(3))

    white = Image.new("RGB", img.size, (255, 255, 255))
    cleaned = Image.composite(white, img, background)

    side = max(w, h)
    square = Image.new("RGB", (side, side), (255, 255, 255))
    square.paste(cleaned, ((side - w) // 2, (side - h) // 2))
    return square


def main() -> None:
    OUT_DIR.mkdir(exist_ok=True)
    paths = sorted(SRC_DIR.glob("*.jpg"))
    for path in paths:
        clean(path).save(OUT_DIR / path.name, quality=90)
    print(f"Cleaned {len(paths)} images -> {OUT_DIR}")


if __name__ == "__main__":
    main()
