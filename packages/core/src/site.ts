// The dashboard's data: the JSON files `rdstudio build` writes into
// .rdstudio/site/data/ and the dashboard reads. One definition for both, so a
// change on either side is caught by the type checker.

import type { Rating } from "./markdown.ts";
import type { IssueCode, Trust } from "./bundle.ts";

/** data/site.json */
export interface SiteInfo {
  title: string;
  knowledge: string;
  reports: string;
  human: string;
  okf_version: string | null;
  static: boolean; // an exported snapshot: no polling, no learner record
  map: Record<string, unknown>; // [map] in rdstudio.toml
  issues: { path: string; level: "error" | "warning"; code: IssueCode; message: string }[];
  counts: { concepts: number; reports: number; skills: number; agents: number; code?: number };
}

/** One entry of data/concepts.json. */
export interface ConceptRecord {
  id: string;
  path: string;
  title: string;
  type: string;
  description: string;
  tags: string[];
  status: string;
  trust: Trust;
  verification_stale: boolean;
  content_stale: boolean;
  hash: string; // the version learner-record events refer to
  order: number; // reading order from requires links
  depth: number; // longest chain of prerequisites below this note
  requires: string[];
  meta: Record<string, unknown>;
  directory: string;
  links: { target: string; kind: "concept" | "directory"; broken: boolean; rel: Rating | null }[];
  backlinks: string[];
  headings: { level: number; text: string; slug: string }[];
  generated_at: string | null;
  mtime: number;
}

/** One entry of data/tree.json, keyed by folder id ("" is the root). */
export interface FolderRecord {
  id: string;
  name: string;
  concepts: string[]; // by title
  children: string[];
  overview: string | null;
  index: string; // the generated index.md
}

export interface ChangedFile {
  path: string;
  status: string;
  category: string;
}

export interface Commit {
  hash: string;
  short: string;
  author: string;
  date: string;
  subject: string;
  files: ChangedFile[];
  pending?: boolean;
  merge?: boolean;
}

/** One item of the code map (T66): a directory, a file, or something defined in one. */
export interface CodeItem {
  /** A directory "src/core/", a file "src/core/system.hpp", or "file#qualified::name". */
  id: string;
  kind: "dir" | "file" | "class" | "function" | "method" | "field" | "constant" | "target" | "job";
  name: string;
  qual: string;
  parent: string | null;
  path: string;
  lang: string;
  line: number;
  end: number;
  signature: string;
  doc: string;
  /** Up to 60 lines of its source, for its page. */
  src: string;
  /** A file declaring a Python extension module (NB_MODULE, PYBIND11_MODULE): its name. */
  module?: string;
  /** The Python name it is bound to. */
  bound?: string;
  /** A C++ definition's declaration. */
  declaration?: string;
}
export type CodeLink = [from: string, to: string, kind: "imports" | "includes" | "calls" | "uses" | "binds" | "implements" | "tests" | "builds"];
/** data/code.json, when the project's code is mapped. */
export interface CodeIndex {
  root: string;
  items: CodeItem[];
  links: CodeLink[];
}

/** data/changes.json */
export interface Changes {
  available: boolean;
  branch?: string;
  commits: Commit[];
}

/** One entry of data/reports.json. */
export interface ReportRecord {
  path: string;
  title: string;
  date: string;
  author: string;
  description: string;
  activity: string;
  links: string[];
}

export interface SkillRecord {
  name: string;
  description: string;
  path: string;
  scope: "project" | "user";
  meta: Record<string, unknown>;
  body: string;
}

/** data/skills.json */
export interface Skills {
  skills: SkillRecord[];
  agents: SkillRecord[];
}

/** data/version.json */
export interface Version {
  version: string;
  built: string;
}
