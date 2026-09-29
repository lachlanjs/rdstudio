---
type: Concept
title: Link syntax
description: Cases where a Markdown parser and simple patterns may disagree.
---

- Brackets in text: [a [nested] label](/target-a.md)
- Parentheses in the target: [paren](/target(b).md)
- Escaped bracket: \[not a link](/target-c.md)
- Link across lines: [split
  label](/target-d.md)
- Reference style: [label][ref-e] and [ref-e]
- Autolink: <https://example.org>
- HTML: <a href="/target-f.md">html</a>
- Inline code with a link inside: `[x](/target-g.md)` and ``[y](/target-h.md)``
- Double backtick code: `` a ` b [z](/target-i.md) ``
- Indented code block follows:

      [indented](/target-j.md)

[ref-e]: /target-e.md
