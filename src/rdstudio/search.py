"""Deterministic BM25 search over an OKF bundle.

Results carry only what an agent needs to decide what to open next (id, title,
description, score, a short snippet); bodies are fetched separately by section.
"""

from __future__ import annotations

import math
import re
from collections import Counter
from dataclasses import dataclass
from typing import Any, Iterable

from .okf import Bundle, Concept, headings

_TOKEN = re.compile(r"[a-z0-9]+(?:['’][a-z]+)?")
_STOP = frozenset(
    "a an and are as at be by for from has have in is it its of on or that the this to was were "
    "will with not but if then than so do does did can could should would into about".split()
)
FIELD_WEIGHTS = {"title": 4, "tags": 3, "description": 2, "headings": 2, "type": 1, "body": 1}
K1, B = 1.4, 0.75


def _stem(token: str) -> str:
    if len(token) > 4 and token.endswith("ies"):
        return token[:-3] + "y"
    if len(token) > 3 and token.endswith("s") and not token.endswith(("ss", "us", "is")):
        return token[:-1]
    return token


def tokenize(text: str) -> list[str]:
    return [_stem(t) for t in _TOKEN.findall(text.lower().replace("’", "'")) if t not in _STOP]


@dataclass
class Hit:
    concept: Concept
    score: float
    snippet: str

    def as_dict(self) -> dict[str, Any]:
        c = self.concept
        return {
            "id": c.id,
            "title": c.title,
            "type": c.type,
            "description": c.description,
            "trust": c.trust,
            "score": round(self.score, 3),
            "snippet": self.snippet,
        }


class Index:
    def __init__(self, bundle: Bundle):
        self.bundle = bundle
        self.docs: dict[str, Counter[str]] = {}
        self.lengths: dict[str, int] = {}
        self.df: Counter[str] = Counter()
        for cid, concept in bundle.concepts.items():
            tf: Counter[str] = Counter()
            fields = {
                "title": concept.title,
                "tags": " ".join(concept.tags),
                "description": concept.description,
                "headings": " ".join(h.text for h in headings(concept.body)),
                "type": concept.type,
                "body": concept.body,
            }
            for name, text in fields.items():
                for token in tokenize(text):
                    tf[token] += FIELD_WEIGHTS[name]
            self.docs[cid] = tf
            self.lengths[cid] = sum(tf.values())
            self.df.update(tf.keys())
        self.avg_len = (sum(self.lengths.values()) / len(self.lengths)) if self.lengths else 0.0

    def _idf(self, token: str) -> float:
        n = len(self.docs)
        df = self.df.get(token, 0)
        return math.log(1 + (n - df + 0.5) / (df + 0.5))

    def search(
        self,
        query: str,
        *,
        limit: int = 8,
        type: str | None = None,
        tags: Iterable[str] | None = None,
        trust: str | None = None,
        status: str | None = None,
        under: str | None = None,
    ) -> list[Hit]:
        terms = tokenize(query)
        wanted_tags = {t.lower() for t in (tags or [])}
        hits: list[Hit] = []
        for cid, tf in self.docs.items():
            c = self.bundle.concepts[cid]
            if type and c.type.lower() != type.lower():
                continue
            if wanted_tags and not wanted_tags <= {t.lower() for t in c.tags}:
                continue
            if trust and c.trust != trust:
                continue
            if status and c.status != status:
                continue
            if under and not (cid + "/").startswith(under.strip("/") + "/"):
                continue
            score = 0.0
            norm = K1 * (1 - B + B * self.lengths[cid] / self.avg_len) if self.avg_len else K1
            for term in terms:
                f = tf.get(term, 0)
                if f:
                    score += self._idf(term) * f * (K1 + 1) / (f + norm)
            if terms and score <= 0:
                continue
            hits.append(Hit(c, score, snippet(c, terms)))
        hits.sort(key=lambda h: (-h.score, h.concept.id))
        return hits[:limit]


def snippet(concept: Concept, terms: list[str], width: int = 160) -> str:
    """The first body line mentioning a query term, trimmed around the match."""
    term_set = set(terms)
    in_fence = False
    for raw in concept.body.split("\n"):
        line = raw.strip()
        if line.startswith(("```", "~~~")):
            in_fence = not in_fence
            continue
        if in_fence or not line:
            continue
        tokens = tokenize(line)
        if term_set & set(tokens):
            lower = line.lower()
            pos = min((lower.find(t) for t in term_set if lower.find(t) >= 0), default=0)
            start = max(0, pos - width // 3)
            if start:
                space = line.find(" ", start)
                start = space + 1 if 0 <= space < pos else start
            text = line[start : start + width]
            return ("…" if start else "") + text + ("…" if start + width < len(line) else "")
    return concept.description[:width]
