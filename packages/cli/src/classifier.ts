// The classifier chosen in rdstudio.toml: the core's rules, or an external
// command that answers JSON: it is sent {question, options, state} and replies
// {choice, confidence} (see choose() below).
//
//   [classifier]
//   backend = "command"
//   command = ["my-classifier"]   # reads JSON on stdin, writes JSON on stdout
//   min_confidence = 0.7          # below this, fall back to the rules

import { execFileSync } from "node:child_process";
import { RulesClassifier, type Classifier, type Decision } from "@rdstudio/core";

export class CommandClassifier implements Classifier {
  private readonly fallback = new RulesClassifier();
  private readonly command: string[];
  private readonly minConfidence: number;
  private readonly timeoutMs: number;

  constructor(command: string[], minConfidence = 0.7, timeoutMs = 10_000) {
    this.command = command;
    this.minConfidence = minConfidence;
    this.timeoutMs = timeoutMs;
  }

  choose(question: string, options: string[], state: Record<string, unknown>): Decision {
    let choice: unknown, confidence: number;
    try {
      const out = execFileSync(this.command[0]!, this.command.slice(1), {
        input: JSON.stringify({ question, options, state }), encoding: "utf8", timeout: this.timeoutMs, stdio: ["pipe", "pipe", "ignore"],
      });
      const answer = JSON.parse(out) as Record<string, unknown>;
      choice = answer.choice;
      confidence = Number(answer.confidence ?? 0);
      if (Number.isNaN(confidence)) throw new Error("bad confidence");
    } catch {
      return this.fallback.choose(question, options, state);
    }
    if (typeof choice !== "string" || !options.includes(choice) || confidence < this.minConfidence) {
      return this.fallback.choose(question, options, state);
    }
    return { choice, confidence, backend: "command" };
  }
}

export function fromConfig(raw: Record<string, unknown>): Classifier {
  const conf = (raw.classifier ?? {}) as Record<string, unknown>;
  if (conf.backend === "command" && conf.command) {
    const command = Array.isArray(conf.command) ? conf.command.map(String) : String(conf.command).split(/\s+/).filter(Boolean);
    return new CommandClassifier(command, Number(conf.min_confidence ?? 0.7));
  }
  return new RulesClassifier();
}
