"""Small structured decisions behind one interface.

Two places in rdstudio need a quick classification rather than generated text:

- whether an edit to a concept is significant (it bumps ``generated`` and flags
  human-reviewed concepts for re-review), when the agent leaves it to rdstudio;
- which step of a procedure an agent is on, when its description does not match
  a step exactly.

The default backend is deterministic and offline. A ``command`` backend hands
the question to any external program, which is how a structured-output model
(for example TypeSafe's Jev) or a local model can be plugged in without
rdstudio depending on a vendor SDK::

    [classifier]
    backend = "command"
    command = ["my-classifier"]   # reads JSON on stdin, writes JSON on stdout
    min_confidence = 0.7          # below this, fall back to the rules

The program receives ``{"question", "options", "state"}`` and must answer
``{"choice": <one of options>, "confidence": <0..1>}``.
"""

from __future__ import annotations

import difflib
import json
import re
import subprocess
from dataclasses import dataclass
from typing import Any, Protocol

from .search import tokenize


@dataclass
class Decision:
    choice: str | None
    confidence: float
    backend: str


class Classifier(Protocol):
    def choose(self, question: str, options: list[str], state: dict[str, Any]) -> Decision: ...


# --------------------------------------------------------------------------- #
# Rules
# --------------------------------------------------------------------------- #

_WS = re.compile(r"\s+")
_PUNCT = re.compile(r"[^\w\s]")


def _norm(text: str) -> str:
    return _WS.sub(" ", _PUNCT.sub("", text.lower())).strip()


def edit_significance(before: str, after: str) -> Decision:
    """``minor`` for formatting, punctuation, case or very small wording changes;
    ``significant`` otherwise."""
    if _norm(before) == _norm(after):
        return Decision("minor", 0.95, "rules")
    a, b = tokenize(before), tokenize(after)
    matcher = difflib.SequenceMatcher(a=a, b=b, autojunk=False)
    changed = sum(max(i2 - i1, j2 - j1) for tag, i1, i2, j1, j2 in matcher.get_opcodes() if tag != "equal")
    if changed <= 3 and changed / max(len(a), 1) < 0.05:
        return Decision("minor", 0.7, "rules")
    return Decision("significant", 0.8 if changed > 10 else 0.6, "rules")


def match_step(description: str, steps: dict[str, str]) -> Decision:
    """The step whose label shares the most words with ``description``."""
    def same(a: str, b: str) -> bool:  # tolerate inflection: "renamed" ~ "rename"
        return a == b or (min(len(a), len(b)) >= 4 and (a.startswith(b) or b.startswith(a)))

    words = set(tokenize(description))
    best, best_score = None, 0.0
    for sid, label in steps.items():
        label_words = set(tokenize(label)) | set(tokenize(sid.replace("-", " ").replace("_", " ")))
        if not label_words or not words:
            continue
        shared = sum(1 for w in words if any(same(w, l) for l in label_words))
        score = shared / (len(words) + len(label_words) - shared)
        if score > best_score:
            best, best_score = sid, score
    return Decision(best if best_score >= 0.34 else None, round(best_score, 2), "rules")


class RulesClassifier:
    def choose(self, question: str, options: list[str], state: dict[str, Any]) -> Decision:
        if question == "edit_significance":
            return edit_significance(state.get("before", ""), state.get("after", ""))
        if question == "procedure_step":
            return match_step(state.get("description", ""), state.get("steps", {}))
        return Decision(None, 0.0, "rules")


# --------------------------------------------------------------------------- #
# External command
# --------------------------------------------------------------------------- #


class CommandClassifier:
    def __init__(self, command: list[str], min_confidence: float = 0.7, timeout: float = 10.0):
        self.command = command
        self.min_confidence = min_confidence
        self.timeout = timeout
        self.fallback = RulesClassifier()

    def choose(self, question: str, options: list[str], state: dict[str, Any]) -> Decision:
        payload = json.dumps({"question": question, "options": options, "state": state})
        try:
            proc = subprocess.run(self.command, input=payload, capture_output=True, text=True,
                                  timeout=self.timeout, check=True)
            answer = json.loads(proc.stdout)
            choice, confidence = answer.get("choice"), float(answer.get("confidence", 0))
        except (OSError, subprocess.SubprocessError, ValueError, AttributeError):
            return self.fallback.choose(question, options, state)
        if choice not in options or confidence < self.min_confidence:
            return self.fallback.choose(question, options, state)
        return Decision(choice, confidence, "command")


def from_config(raw: dict[str, Any]) -> Classifier:
    conf = raw.get("classifier", {})
    if conf.get("backend") == "command" and conf.get("command"):
        command = conf["command"]
        return CommandClassifier(command if isinstance(command, list) else str(command).split(),
                                 float(conf.get("min_confidence", 0.7)))
    return RulesClassifier()
