#!/usr/bin/env python3
"""
Batch generator routed into testdata/:
- Writes: testdata/1.in, 1.ans, ..., testdata/N.in, N.ans
- Shapes: free polyominoes (rot/ref + translation canonical), hole-free only
- Per case:
  * pick k ~ Uniform{6..15} (clamped to enumerated max)
  * target total cells C_target = round(10^U(2,5))
  * sample shapes uniformly from sizes <= k until sum(cells) >= C_target
- .ans files contain "zzz"
"""

import os
import random
import argparse
from collections import deque
from typing import List, Set, Tuple

DIRS4 = [(1,0), (-1,0), (0,1), (0,-1)]
Cell = Tuple[int, int]

# ---------- Polyomino canonicalization / enumeration (free + hole test) ----------

def normalize(cells: Set[Cell]):
    """Translate so min x = min y = 0 and return sorted tuple of cells."""
    minx = min(x for x,_ in cells)
    miny = min(y for _,y in cells)
    return tuple(sorted((x-minx, y-miny) for x,y in cells))

def rot90cw(x:int, y:int): return (y, -x)
def reflect_y(x:int, y:int): return (-x, y)

def canonical_D4(cells: Set[Cell]):
    """Return canonical representative under D4 (8 symmetries)."""
    base = list(cells)
    variants = []
    for f in (0, 1):  # reflect or not (across y)
        pts = [(reflect_y(x,y) if f else (x,y)) for x,y in base]
        cur = pts
        for r in range(4):
            if r > 0:
                cur = [rot90cw(x, y) for x, y in cur]
            variants.append(normalize(set(cur)))
    return min(variants)

def border_neighbors(shape):
    """4-neighbor cells just outside the polyomino."""
    shape = set(shape)
    nbrs = set()
    for x,y in shape:
        for dx,dy in DIRS4:
            q = (x+dx, y+dy)
            if q not in shape:
                nbrs.add(q)
    return nbrs

def enumerate_free_polyominoes(max_k: int) -> List[List[Tuple[Cell, ...]]]:
    """
    Return list L where L[k-1] is the list of canonical free polyominoes of size k.
    Uses Redelmeier-like growth from size 1 upward with canonicalization.
    """
    size_classes: List[Set[Tuple[Cell, ...]]] = [set() for _ in range(max_k)]
    size_classes[0].add(((0,0),))  # size-1

    for k in range(2, max_k+1):
        newset: Set[Tuple[Cell, ...]] = set()
        for poly in size_classes[k-2]:
            S = set(poly)
            for q in border_neighbors(poly):
                S2 = set(S); S2.add(q)
                newset.add(canonical_D4(S2))
        size_classes[k-1] = newset

    # sort each class deterministically
    return [sorted(list(s)) for s in size_classes]

def is_hole_free(shape: Tuple[Cell, ...]) -> bool:
    """Flood-fill from bounding box border to detect interior voids."""
    S = set(shape)
    xs = [x for x,_ in S]; ys = [y for _,y in S]
    minx, maxx = min(xs)-1, max(xs)+1
    miny, maxy = min(ys)-1, max(ys)+1

    ext = set()
    q = deque()

    # seed the outside ring
    for x in range(minx, maxx+1):
        for y in (miny, maxy):
            if (x,y) not in S:
                if (x,y) not in ext:
                    ext.add((x,y)); q.append((x,y))
    for y in range(miny, maxy+1):
        for x in (minx, maxx):
            if (x,y) not in S and (x,y) not in ext:
                ext.add((x,y)); q.append((x,y))

    # BFS in empty cells to mark exterior
    while q:
        x,y = q.popleft()
        for dx,dy in DIRS4:
            nx, ny = x+dx, y+dy
            if nx < minx or nx > maxx or ny < miny or ny > maxy:
                continue
            if (nx,ny) in S or (nx,ny) in ext:
                continue
            ext.add((nx,ny)); q.append((nx,ny))

    # any interior empty cell not reached => hole
    for x in range(minx+1, maxx):
        for y in range(miny+1, maxy):
            if (x,y) not in S and (x,y) not in ext:
                return False
    return True

def filter_hole_free(all_by_size: List[List[Tuple[Cell, ...]]]) -> List[List[Tuple[Cell, ...]]]:
    return [[sh for sh in shapes if is_hole_free(sh)] for shapes in all_by_size]

# ---------- Sampling helpers ----------

def sample_cell_cap(rng: random.Random) -> int:
    """p ~ U(2,5) → C_target = round(10^p) in ~[100, 100000]."""
    p = rng.uniform(2, 5)
    return max(1, int(round(10**p)))

# ---------- Writing testcases ----------

def write_case(idx: int, outdir: str, hf_by_size: List[List[Tuple[Cell, ...]]],
               rng: random.Random, enum_max_k: int):
    """
    - pick k ~ Uniform{6..15} (clamped to enum_max_k)
    - pool = union of sizes <= k (hole-free only)
    - keep adding random shapes until total cells >= C_target
    """
    k_pick = rng.randint(6, 15)
    k_use = min(k_pick, enum_max_k)

    # Build pool of shapes of size <= k_use
    pool: List[Tuple[Cell, ...]] = [sh for s in hf_by_size[:k_use] for sh in s]
    if not pool:
        raise RuntimeError("Shape pool is empty; increase --maxK or fix enumeration.")

    C_target = sample_cell_cap(rng)
    chosen: List[Tuple[Cell, ...]] = []
    total_cells = 0

    while total_cells < C_target:
        poly = rng.choice(pool)
        chosen.append(poly)
        total_cells += len(poly)

    n = len(chosen)

    in_path = os.path.join(outdir, f"{idx}.in")
    ans_path = os.path.join(outdir, f"{idx}.ans")

    with open(in_path, "w") as f:
        f.write(str(n) + "\n")
        for poly in chosen:
            f.write(str(len(poly)) + "\n")
            for x, y in poly:
                f.write(f"{x} {y}\n")

    with open(ans_path, "w") as f:
        f.write("zzz\n")

    return in_path, ans_path, k_pick, k_use, n, len(pool), C_target, total_cells

# ---------- Main ----------

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--count", type=int, default=20, help="#tests to generate")
    ap.add_argument("--out", default="testdata", help="output folder")
    ap.add_argument("--seed", type=int, default=1000, help="base PRNG seed")
    ap.add_argument("--maxK", type=int, default=15,
                    help="enumerate shapes up to this size (12 fast-ish; 15 is slower)")
    args = ap.parse_args()

    os.makedirs(args.out, exist_ok=True)

    enum_max_k = max(1, args.maxK)

    print(f"[info] enumerating free polyominoes up to k={enum_max_k} …")
    all_by_size = enumerate_free_polyominoes(enum_max_k)
    print("[info] filtering hole-free …")
    hf_by_size = filter_hole_free(all_by_size)

    total_pool = sum(len(s) for s in hf_by_size)
    print(f"[info] total hole-free polyominoes (sizes ≤ {enum_max_k}) = {total_pool}")

    for i in range(1, args.count + 1):
        rng = random.Random(args.seed + i)
        inp, ans, k_pick, k_use, n, pool_sz, C_target, C_hit = write_case(
            i, args.out, hf_by_size, rng, enum_max_k
        )
        print(f"✔ wrote {inp}  {ans}  | k_pick={k_pick}→{k_use}, "
              f"n={n}, |pool|={pool_sz}, cells_target={C_target}, cells_emitted={C_hit}")

if __name__ == "__main__":
    main()
