"""Generate synthetic OKF projects for benchmarks.

A body of knowledge is a tree: folders nested ``depth - 1`` deep, with notes as
the last layer, and each level branching about ``branch`` ways (varied by up to
two either side). Links are shaped like a real subject's (the differential
geometry test bed has about 1.5 requires, 0.7 uses and 2.1 see also links per
note): requires links point to earlier notes, mostly nearby; see also links
roam further. Everything comes from the seed, so a preset is the same on every
machine.

    python bench/synth.py field .bench/bundles/field
"""

from __future__ import annotations

import argparse
import bisect
import random
import sys
from dataclasses import dataclass, field
from pathlib import Path

# name: (depth, branch). Notes are roughly branch ** depth.
PRESETS = {
    "subject": (2, 8),   # ~64 notes: one subject, the size of the test bed
    "area": (3, 6),      # ~216: a broad area, several subjects
    "field": (4, 6),     # ~1,300: a whole field, subjects as bubbles within it
    "ceiling": (4, 8),   # ~4,100: past anything expected; the upper bound
}

SYLLABLES = ("ka", "lo", "mi", "ter", "gon", "ra", "vel", "sin", "tor", "an", "mor", "phi", "del", "ta",
             "nu", "cor", "lin", "ex", "pro", "jec", "tan", "gen", "sur", "fa", "ce", "bun", "dle", "quo")
TYPES = ("Definition", "Definition", "Theorem", "Example", "Concept")
WORDS = ("space", "map", "manifold", "bundle", "form", "field", "curve", "surface", "metric", "group",
         "flow", "chart", "vector", "tensor", "section", "operator", "measure", "class", "sequence", "limit")


def word(rng: random.Random) -> str:
    return "".join(rng.choice(SYLLABLES) for _ in range(rng.randint(2, 3)))


def title(rng: random.Random) -> str:
    return " ".join([word(rng).capitalize()] + [rng.choice(WORDS) for _ in range(rng.randint(0, 2))])


def slug(text: str) -> str:
    return "-".join(text.lower().split())


@dataclass
class Note:
    path: str  # without .md
    title: str
    folder: tuple[int, ...]  # position in the tree, for locality
    links: list[tuple[str, str]] = field(default_factory=list)  # (path, rating)


def tree(rng: random.Random, depth: int, branch: int) -> list[Note]:
    notes: list[Note] = []

    def grow(prefix: str, pos: tuple[int, ...], level: int) -> None:
        count = branch if level == 0 else max(2, branch + rng.randint(-2, 2))
        for i in range(count):
            name = title(rng)
            if level == depth - 1:
                notes.append(Note(f"{prefix}{slug(name)}-{i}", name, pos))
            else:
                grow(f"{prefix}{word(rng)}-{i}/", pos + (i,), level + 1)

    grow("", (), 0)
    return notes


def near(rng: random.Random, notes: list[Note], groups: dict[tuple[int, ...], list[int]], i: int,
         before: bool) -> Note | None:
    """Another note, most often in the same folder, then the parent's, then anywhere."""
    me = notes[i]
    r = rng.random()
    share = len(me.folder) if r < 0.6 else max(0, len(me.folder) - 1) if r < 0.85 else 0
    group = groups[me.folder[:share]]  # indices, ascending
    if before:
        group = group[:bisect.bisect_left(group, i)]
    return notes[rng.choice(group)] if group else None


def link(rng: random.Random, notes: list[Note]) -> None:
    # Notes are generated folder by folder, which is a sensible reading order,
    # so requires links point backwards and the graph has no cycles.
    groups: dict[tuple[int, ...], list[int]] = {}
    for i, n in enumerate(notes):
        for k in range(len(n.folder) + 1):
            groups.setdefault(n.folder[:k], []).append(i)
    for i, n in enumerate(notes):
        for rating, mean, before in (("requires", 1.5, True), ("uses", 0.7, True), ("see also", 2.1, False)):
            for _ in range(rng.randint(0, round(mean * 2))):
                roam = rating == "see also" and rng.random() < 0.4
                other = rng.choice(notes) if roam else near(rng, notes, groups, i, before)
                if other and other is not n and all(p != other.path for p, _ in n.links):
                    n.links.append((other.path, rating))


def body(rng: random.Random, n: Note, by_path: dict[str, Note]) -> str:
    sentences = [f"A {rng.choice(WORDS)} is {rng.choice(('smooth', 'compact', 'closed', 'exact', 'flat'))} "
                 f"when its {rng.choice(WORDS)} vanishes." for _ in range(rng.randint(3, 8))]
    lines = ["# Definition", "", " ".join(sentences), "",
             f"$$ {rng.choice('abcdefg')}_{{ij}} = \\partial_i {rng.choice('xyzuvw')}^j $$", "", "# Key facts", ""]
    for p, rating in n.links:
        lines.append(f"- Relates to [{by_path[p].title}](/{p}.md \"{rating}\"): {' '.join(rng.sample(sentences, 1))}")
    return "\n".join(lines) + "\n"


def generate(target: Path, depth: int, branch: int, *, seed: int = 1, name: str = "Synthetic") -> int:
    rng = random.Random(seed)
    notes = tree(rng, depth, branch)
    link(rng, notes)
    by_path = {n.path: n for n in notes}
    knowledge = target / "knowledge"
    target.mkdir(parents=True, exist_ok=True)
    (target / "rdstudio.toml").write_text(f'[project]\ntitle = "{name}"\n', encoding="utf-8")
    for n in notes:
        path = knowledge / f"{n.path}.md"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            f"---\ntype: {rng.choice(TYPES)}\ntitle: {n.title}\n"
            f"description: A synthetic note about the {rng.choice(WORDS)} of {n.title.lower()}.\n"
            f"tags: [synthetic]\ngenerated: {{ by: bench/synth, at: 2026-01-01T00:00:00Z }}\n---\n\n"
            + body(rng, n, by_path), encoding="utf-8")
    return len(notes)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("preset", choices=[*PRESETS, "custom"])
    ap.add_argument("target", type=Path)
    ap.add_argument("--depth", type=int, help="layers, notes included (custom)")
    ap.add_argument("--branch", type=int, help="average branching (custom)")
    ap.add_argument("--seed", type=int, default=1)
    args = ap.parse_args(argv)
    depth, branch = PRESETS.get(args.preset, (args.depth, args.branch))
    if not depth or not branch:
        ap.error("custom needs --depth and --branch")
    if args.target.exists() and any(args.target.iterdir()):
        ap.error(f"{args.target} is not empty")
    count = generate(args.target, depth, branch, seed=args.seed, name=f"Synthetic {args.preset}")
    print(f"{count} notes in {args.target}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
