// The code map's index (T66): a codebase read from its directories down to
// functions and important variables, with the links between them. Python and
// C++ are parsed with tree-sitter (WASM grammars from npm, so it works
// offline); CMake targets and CI jobs are read line by line. Written to
// data/code.json by the build, for the Atlas's Code view and code pages.
//
// Levels: directories, files, classes (C++ namespaces fold into names),
// functions, methods, fields and constants. Links: imports and includes,
// calls between known names, nanobind/pybind11 bindings (so a Python call to
// _core.Gravity reaches the C++ class), a C++ definition to its declaration,
// tests to what they exercise, and the files a CMake target builds.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, posix } from "node:path";
import { fileURLToPath } from "node:url";
import type { CodeIndex, CodeItem, CodeLink } from "@rdstudio/core";
import type { Config } from "./config.ts";

type Node = import("web-tree-sitter").Node;
type Lang = "python" | "cpp" | "cmake" | "yaml" | "toml" | "markdown" | "other";

const require = createRequire(import.meta.url);
const MAX_FILE = 400_000; // bytes; bigger files are listed, not parsed
const MAX_SRC = 60; // lines of source kept per item, for its page

const CPP_EXT = new Set([".cpp", ".cc", ".cxx", ".hpp", ".hh", ".hxx", ".h", ".ipp"]);
function langOf(path: string): Lang {
  const ext = posix.extname(path).toLowerCase();
  if (ext === ".py" || ext === ".pyi") return "python";
  if (CPP_EXT.has(ext)) return "cpp";
  if (posix.basename(path) === "CMakeLists.txt" || ext === ".cmake") return "cmake";
  if (ext === ".yml" || ext === ".yaml") return "yaml";
  if (ext === ".toml") return "toml";
  if (ext === ".md") return "markdown";
  return "other";
}

/** Whether this project's code is mapped: [code] enabled, or a codebase or project profile. */
export function codeEnabled(cfg: Config): boolean {
  const code = cfg.raw.code as Record<string, unknown> | undefined;
  if (code && typeof code.enabled === "boolean") return code.enabled;
  const teacher = cfg.raw.teacher as Record<string, unknown> | undefined;
  return teacher?.profile === "codebase" || teacher?.profile === "project";
}

let parsers: Promise<{ python: import("web-tree-sitter").Parser; cpp: import("web-tree-sitter").Parser }> | null = null;
function loadParsers() {
  parsers ??= (async () => {
    const { Parser, Language } = await import("web-tree-sitter");
    await Parser.init();
    const load = async (pkg: string) => Language.load(join(dirname(require.resolve(`${pkg}/package.json`)), `${pkg}.wasm`));
    const python = new Parser(); python.setLanguage(await load("tree-sitter-python"));
    const cpp = new Parser(); cpp.setLanguage(await load("tree-sitter-cpp"));
    return { python, cpp };
  })();
  return parsers;
}

/** The files to index: tracked by git (or, without git, none), outside the notes and reports. */
function filesOf(cfg: Config): string[] {
  let out: string[];
  try {
    out = execFileSync("git", ["ls-files", "-z"], { cwd: cfg.root, encoding: "utf8", maxBuffer: 64 << 20 }).split("\0").filter(Boolean);
  } catch {
    return [];
  }
  const skip = [cfg.knowledge, cfg.reports, ".rdstudio"].map((p) => p.replace(/^\/+|\/+$/g, "") + "/");
  const code = cfg.raw.code as Record<string, unknown> | undefined;
  const include = Array.isArray(code?.include) ? (code.include as string[]) : null;
  const exclude = Array.isArray(code?.exclude) ? (code.exclude as string[]) : [];
  return out.filter((p) => !skip.some((s) => p.startsWith(s)) && (!include || include.some((i) => p.startsWith(i))) && !exclude.some((e) => p.startsWith(e)));
}

export async function indexCode(cfg: Config): Promise<CodeIndex | null> {
  if (!codeEnabled(cfg)) return null;
  const files = filesOf(cfg);
  if (!files.length) return null;
  const { python, cpp } = await loadParsers();
  const items = new Map<string, CodeItem>();
  const links: CodeLink[] = [];
  const add = (it: CodeItem) => { if (!items.has(it.id)) items.set(it.id, it); return items.get(it.id)!; };

  // Directories and files.
  const dirOf = (p: string) => (p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "");
  const ensureDir = (d: string): string => {
    const id = d + "/";
    if (d && !items.has(id)) {
      const parent = d.includes("/") ? ensureDir(dirOf(d)) : null;
      add({ id, kind: "dir", name: posix.basename(d), qual: d, parent, path: d, lang: "other", line: 0, end: 0, signature: "", doc: "", src: "" });
    }
    return d ? id : (null as unknown as string);
  };
  const sources = new Map<string, string>();
  for (const path of files) {
    const parent = path.includes("/") ? ensureDir(dirOf(path)) : null;
    const lang = langOf(path);
    add({ id: path, kind: "file", name: posix.basename(path), qual: path, parent, path, lang, line: 1, end: 0, signature: "", doc: "", src: "" });
    if (lang === "other" || lang === "markdown" || lang === "toml") continue;
    const abs = join(cfg.root, path);
    if (!existsSync(abs) || statSync(abs).size > MAX_FILE) continue;
    sources.set(path, readFileSync(abs, "utf8"));
  }

  // What each file defines, and the names it uses.
  interface Use { from: string; name: string; on: string | null; kind: "call" | "attr" }
  const uses: Use[] = [];
  const imports: { from: string; module: string; names: string[]; level: number }[] = [];
  const includes: { from: string; target: string }[] = [];
  const binds: { from: string; cpp: string; py: string }[] = [];
  const declared = new Map<string, string>(); // C++ qualified name -> declaring item id
  const defs: { id: string; qual: string }[] = []; // C++ out-of-class definitions, to join to their declarations
  const lines = (src: string, n: Node) => src.split("\n").slice(n.startPosition.row, Math.min(n.endPosition.row + 1, n.startPosition.row + MAX_SRC)).join("\n");
  const firstLine = (n: Node) => n.text.split("\n")[0]!.trim().replace(/\s*[{:]\s*$/, "");

  for (const [path, src] of sources) {
    const lang = langOf(path);
    if (lang === "python") {
      const tree = python.parse(src)!;
      const item = (n: Node, kind: CodeItem["kind"], name: string, qual: string, parent: string, doc = ""): CodeItem =>
        add({ id: `${path}#${qual}`, kind, name, qual, parent, path, lang, line: n.startPosition.row + 1, end: n.endPosition.row + 1, signature: firstLine(n), doc, src: lines(src, n) });
      const docOf = (body: Node | null) => {
        const s = body?.namedChildren[0];
        const str = s?.type === "expression_statement" ? s.namedChildren[0] : null;
        return str?.type === "string" ? str.text.replace(/^[rbuRBU]*("""|'''|"|')/, "").replace(/("""|'''|"|')$/, "").trim() : "";
      };
      const walkUses = (n: Node, owner: string) => {
        if (n.type === "call") {
          const fn = n.childForFieldName("function");
          if (fn?.type === "identifier") uses.push({ from: owner, name: fn.text, on: null, kind: "call" });
          else if (fn?.type === "attribute") uses.push({ from: owner, name: fn.childForFieldName("attribute")!.text, on: fn.childForFieldName("object")?.text ?? null, kind: "call" });
        } else if (n.type === "attribute" && n.parent?.type !== "call") {
          uses.push({ from: owner, name: n.childForFieldName("attribute")!.text, on: n.childForFieldName("object")?.text ?? null, kind: "attr" });
        }
        for (const c of n.namedChildren) walkUses(c, owner);
      };
      const defn = (n: Node) => (n.type === "decorated_definition" ? n.childForFieldName("definition")! : n);
      const visit = (n: Node, parent: string, prefix: string, inClass: boolean) => {
        for (const raw of n.namedChildren) {
          const c = defn(raw);
          if (c.type === "class_definition") {
            const name = c.childForFieldName("name")!.text, qual = prefix + name, body = c.childForFieldName("body");
            const it = item(raw, "class", name, qual, parent, docOf(body));
            for (const base of c.childForFieldName("superclasses")?.namedChildren ?? []) uses.push({ from: it.id, name: base.text.split(".").pop()!, on: null, kind: "call" });
            if (body) visit(body, it.id, qual + ".", true);
          } else if (c.type === "function_definition") {
            const name = c.childForFieldName("name")!.text, qual = prefix + name, body = c.childForFieldName("body");
            const it = item(raw, inClass ? "method" : "function", name, qual, parent, docOf(body));
            if (body) walkUses(body, it.id);
          } else if (c.type === "expression_statement" && c.namedChildren[0]?.type === "assignment") {
            // Important variables: module constants (UPPER_CASE) and class fields (annotated).
            const a = c.namedChildren[0]!, left = a.childForFieldName("left");
            if (left?.type !== "identifier") continue;
            const name = left.text, typed = !!a.childForFieldName("type");
            if (inClass ? typed || /^[A-Z][A-Z0-9_]*$/.test(name) : /^[A-Z][A-Z0-9_]*$/.test(name)) item(c, inClass ? "field" : "constant", name, prefix + name, parent);
            const right = a.childForFieldName("right");
            if (right) walkUses(right, parent);
          } else if (c.type === "import_from_statement") {
            const mod = c.childForFieldName("module_name");
            const text = mod?.text ?? "";
            const level = (text.match(/^\.+/)?.[0].length) ?? 0;
            const names = c.namedChildren.filter((x) => x !== mod && (x.type === "dotted_name" || x.type === "aliased_import")).map((x) => (x.type === "aliased_import" ? x.childForFieldName("name")!.text : x.text));
            imports.push({ from: path, module: text.replace(/^\.+/, ""), names, level });
          } else if (c.type === "import_statement") {
            for (const x of c.namedChildren) imports.push({ from: path, module: (x.type === "aliased_import" ? x.childForFieldName("name")! : x).text, names: [], level: 0 });
          } else if (!inClass) walkUses(c, path);
        }
      };
      visit(tree.rootNode, path, "", false);
      const fileDoc = docOf(tree.rootNode);
      if (fileDoc) items.get(path)!.doc = fileDoc;
      tree.delete();
    } else if (lang === "cpp") {
      const tree = cpp.parse(src)!;
      const item = (n: Node, kind: CodeItem["kind"], name: string, qual: string, parent: string, doc = ""): CodeItem =>
        add({ id: `${path}#${qual}`, kind, name, qual, parent, path, lang, line: n.startPosition.row + 1, end: n.endPosition.row + 1, signature: firstLine(n), doc, src: lines(src, n) });
      // The comment lines right above a node, as its documentation.
      const docOf = (n: Node) => {
        const out: string[] = [];
        for (let p = n.previousNamedSibling; p?.type === "comment" && p.endPosition.row >= (out.length ? 0 : n.startPosition.row - 1); p = p.previousNamedSibling) {
          out.unshift(p.text.replace(/^\/\/\/?\s?|^\/\*+\s?|\s*\*\/$/g, ""));
          if (p.previousNamedSibling && p.previousNamedSibling.endPosition.row < p.startPosition.row - 1) break;
        }
        return out.join(" ").trim();
      };
      const declName = (d: Node | null): string | null => {
        while (d && !["identifier", "field_identifier", "qualified_identifier", "destructor_name", "operator_name"].includes(d.type)) d = d.childForFieldName("declarator");
        return d?.text ?? null;
      };
      const isFunctionDecl = (d: Node | null): boolean => {
        for (; d; d = d.childForFieldName("declarator")) if (d.type === "function_declarator") return true;
        return false;
      };
      const walkUses = (n: Node, owner: string) => {
        if (n.type === "call_expression") {
          const fn = n.childForFieldName("function");
          const name = fn?.type === "field_expression" ? fn.childForFieldName("field")?.text : fn?.text.split("::").pop()?.replace(/<.*$/, "");
          if (name) uses.push({ from: owner, name, on: null, kind: "call" });
        } else if (n.type === "type_identifier" || n.type === "template_type") {
          uses.push({ from: owner, name: n.text.replace(/<.*$/, "").split("::").pop()!, on: null, kind: "attr" });
        }
        // nanobind and pybind11: class_<T>(m, "Py") and m.def("py", &f) / .def("py", &T::f)
        if (n.type === "call_expression") {
          const fn = n.childForFieldName("function"), args = n.childForFieldName("arguments")?.namedChildren ?? [];
          const lit = args.find((a) => a.type === "string_literal")?.text.replace(/^"|"$/g, "");
          const tmpl = fn?.type === "template_function" || fn?.type === "qualified_identifier" ? fn.text.match(/class_<\s*([\w:]+)/)?.[1] : null;
          if (tmpl && lit) binds.push({ from: owner, cpp: tmpl.split("::").pop()!, py: lit });
          const ref = args.find((a) => a.type === "pointer_expression" || a.type === "unary_expression")?.text.replace(/^&/, "");
          if (lit && ref && /\.def$|^def$/.test(fn?.text.split(/\s/).pop() ?? "")) binds.push({ from: owner, cpp: ref.split("::").pop()!, py: lit });
        }
        for (const c of n.namedChildren) walkUses(c, owner);
      };
      const visit = (n: Node, parent: string, prefix: string, cls: string | null) => {
        for (const c of n.namedChildren) {
          if (c.type === "namespace_definition") {
            const ns = c.childForFieldName("name")?.text;
            const body = c.childForFieldName("body");
            if (body) visit(body, parent, prefix + (ns ? ns + "::" : ""), null);
          } else if (c.type === "class_specifier" || c.type === "struct_specifier") {
            const nameNode = c.childForFieldName("name"), body = c.childForFieldName("body");
            if (!nameNode || !body) continue;
            const name = nameNode.text, qual = prefix + name;
            const it = item(c, "class", name, qual, parent, docOf(c));
            declared.set(qual, it.id);
            for (const base of c.namedChildren.find((x) => x.type === "base_class_clause")?.namedChildren ?? []) uses.push({ from: it.id, name: base.text.split("::").pop()!.replace(/<.*$/, ""), on: null, kind: "attr" });
            visit(body, it.id, qual + "::", qual);
          } else if (c.type === "template_declaration") {
            visit(c, parent, prefix, cls);
          } else if (c.type === "function_definition") {
            const name = declName(c.childForFieldName("declarator"));
            if (!name) continue;
            const qual = (name.startsWith("::") ? "" : prefix) + name.replace(/^::/, ""); // Body::energy inside namespace sim is sim::Body::energy
            const it = item(c, cls ? "method" : "function", name.split("::").pop()!, qual, parent, docOf(c));
            if (!cls && name.includes("::")) defs.push({ id: it.id, qual });
            else declared.set(qual, it.id);
            const body = c.childForFieldName("body");
            if (body) walkUses(body, it.id);
          } else if (c.type === "field_declaration" || c.type === "declaration") {
            const d = c.childForFieldName("declarator");
            const name = declName(d);
            if (!name) { walkUses(c, parent); continue; }
            const qual = prefix + name;
            if (isFunctionDecl(d)) {
              if (cls) { const it = item(c, "method", name, qual, parent, docOf(c)); declared.set(qual, it.id); }
              else { const it = item(c, "function", name, qual, parent, docOf(c)); declared.set(qual, it.id); }
            } else if (cls) item(c, "field", name, qual, parent, docOf(c));
            else if (/\bconst(expr)?\b/.test(c.text) || /^[A-Z][A-Z0-9_]*$/.test(name)) { const it = item(c, "constant", name, qual, parent, docOf(c)); declared.set(qual, it.id); }
            walkUses(c, cls ? parent : path);
          } else if (c.type === "preproc_include") {
            const target = c.childForFieldName("path")?.text;
            if (target?.startsWith("\"")) includes.push({ from: path, target: target.replace(/"/g, "") });
          } else if (c.type === "expression_statement" || c.type === "preproc_ifdef" || c.type === "preproc_if" || c.type === "linkage_specification" || c.type === "declaration_list") {
            visit(c, parent, prefix, cls);
          } else if (c.type === "function_declarator" || c.type === "compound_statement") {
            walkUses(c, parent);
          } else if (c.type === "ERROR") {
            visit(c, parent, prefix, cls);
          } else if (!cls) {
            walkUses(c, path);
          }
          // NB_MODULE(_core, m) { ... } / PYBIND11_MODULE: a macro the grammar reads as a function definition
          if (c.type === "function_definition" && /^(NB|PYBIND11)_MODULE\b/.test(c.text)) {
            const mod = c.text.match(/_MODULE\s*\(\s*(\w+)/)?.[1];
            if (mod) items.get(path)!.module = mod;
          }
        }
      };
      visit(tree.rootNode, path, "", null);
      tree.delete();
    } else if (lang === "cmake") {
      // Targets, and the sources they build.
      const re = /\b(add_library|add_executable|nanobind_add_module|pybind11_add_module)\s*\(\s*([\w-]+)([^)]*)\)/g;
      for (const m of src.matchAll(re)) {
        const line = src.slice(0, m.index).split("\n").length;
        const it = add({ id: `${path}#${m[2]}`, kind: "target", name: m[2]!, qual: m[2]!, parent: path, path, lang, line, end: line + m[0].split("\n").length - 1, signature: `${m[1]}(${m[2]})`, doc: "", src: m[0] });
        const base = dirOf(path);
        for (const s of m[3]!.split(/\s+/).filter((x) => /\.\w+$/.test(x))) links.push([it.id, posix.join(base, s), "builds"]);
      }
    } else if (lang === "yaml" && path.startsWith(".github/workflows/")) {
      // CI jobs: the keys under jobs:
      const rows = src.split("\n"), at = rows.findIndex((r) => /^jobs:\s*$/.test(r));
      if (at >= 0) for (let i = at + 1; i < rows.length; i++) {
        const m = rows[i]!.match(/^ {2}([\w-]+):\s*$/);
        if (m) add({ id: `${path}#${m[1]}`, kind: "job", name: m[1]!, qual: m[1]!, parent: path, path, lang, line: i + 1, end: i + 1, signature: `job ${m[1]}`, doc: "", src: "" });
        else if (/^\S/.test(rows[i]!)) break;
      }
    }
  }

  // ---------------------------------------------------------------- links
  const all = [...items.values()];
  const byName = new Map<string, CodeItem[]>();
  for (const it of all) if (!["dir", "file", "target", "job"].includes(it.kind)) (byName.get(it.name) ?? byName.set(it.name, []).get(it.name)!).push(it);
  const fileOf = (id: string) => id.split("#")[0]!;
  const isTest = (p: string) => /(^|\/)tests?\//.test(p) || /(^|\/)test_[^/]*$|_test\.\w+$/.test(p);

  // Python modules: dotted name -> file, from the package layout.
  const modules = new Map<string, string>();
  for (const p of files) {
    if (langOf(p) !== "python") continue;
    const parts = p.replace(/\.pyi?$/, "").split("/");
    if (parts.at(-1) === "__init__") parts.pop();
    for (let k = 0; k < parts.length; k++) modules.set(parts.slice(k).join("."), p);
  }
  // nanobind/pybind11 extension modules: "_core" -> the binding file that declares it.
  const extensions = new Map<string, string>();
  for (const it of all) if (it.kind === "file" && it.module) extensions.set(it.module, it.id);
  const bound = new Map<string, string>(); // Python name -> C++ item id
  for (const b of binds) {
    const cands = byName.get(b.cpp) ?? [];
    const target = cands.find((c) => c.kind === "class") ?? cands.find((c) => declared.get(c.qual) === c.id) ?? cands[0];
    if (!target) continue;
    links.push([b.from, target.id, "binds"]);
    if (!bound.has(b.py)) bound.set(b.py, target.id);
    target.bound = target.bound ?? b.py;
  }
  // Which names each Python file imported from where, so `_core.Gravity` resolves through the binding.
  const extAlias = new Map<string, Set<string>>(); // file -> names that refer to an extension module
  for (const im of imports) {
    const fromDir = dirOf(im.from).replace(/\//g, ".");
    let base = im.module;
    if (im.level) { const up = fromDir.split(".").slice(0, Math.max(0, fromDir.split(".").length - (im.level - 1))).join("."); base = [up, im.module].filter(Boolean).join("."); }
    const targets = im.names.length && !im.module ? im.names.map((n) => [base, n].filter(Boolean).join(".")) : [base];
    for (const t of targets) {
      const tail = t.split(".").pop()!;
      if (extensions.has(tail)) { (extAlias.get(im.from) ?? extAlias.set(im.from, new Set()).get(im.from)!).add(tail); links.push([im.from, extensions.get(tail)!, "imports"]); continue; }
      const file = modules.get(t) ?? modules.get(base);
      if (file && file !== im.from) links.push([im.from, file, "imports"]);
    }
    if (extensions.has(base.split(".").pop()!)) for (const n of im.names) (extAlias.get(im.from) ?? extAlias.set(im.from, new Set()).get(im.from)!).add(n), bound.has(n) && links.push([im.from, bound.get(n)!, "imports"]);
  }
  for (const inc of includes) {
    const cands = [posix.join(dirOf(inc.from), inc.target), inc.target, ...[...new Set(files.map((f) => f.split("/")[0]!))].map((top) => posix.join(top, inc.target))];
    const hit = cands.find((c) => items.has(c));
    if (hit && hit !== inc.from) links.push([inc.from, hit, "includes"]);
  }
  for (const d of defs) {
    const decl = declared.get(d.qual) ?? declared.get(d.qual.replace(/^.*?::/, ""));
    if (decl && decl !== d.id) {
      links.push([d.id, decl, "implements"]);
      const it = items.get(d.id)!;
      it.declaration = decl;
      if (items.get(decl)!.kind === "method") it.kind = "method";
    }
  }
  // Calls (and uses of types) between known names: the same file first, then a unique name.
  for (const u of uses) {
    const fromFile = fileOf(u.from);
    let target: string | undefined;
    if (u.on && extAlias.get(fromFile)?.has(u.on)) target = bound.get(u.name);
    if (!target) {
      const cands = (byName.get(u.name) ?? []).filter((c) => c.id !== u.from);
      const same = cands.filter((c) => c.path === fromFile);
      const pick = same.length === 1 ? same[0] : cands.length === 1 ? cands[0] : cands.filter((c) => c.kind === "class").length === 1 ? cands.find((c) => c.kind === "class") : undefined;
      target = pick?.id;
    }
    if (target && target !== u.from) links.push([u.from, target, isTest(fromFile) && !isTest(fileOf(target)) ? "tests" : u.kind === "call" ? "calls" : "uses"]);
  }

  const seen = new Set<string>();
  const unique = links.filter(([a, b, k]) => items.has(a) && items.has(b) && a !== b && !seen.has(a + "\n" + b + "\n" + k) && seen.add(a + "\n" + b + "\n" + k));
  return { root: cfg.root.split("/").pop() ?? "", items: [...items.values()], links: unique };
}

// ---------------------------------------------------------------- for the build

/** The files the index reads, with their times: whether to index again. */
export function codeStamp(cfg: Config): string {
  if (!codeEnabled(cfg)) return "";
  return filesOf(cfg).map((p) => { try { const st = statSync(join(cfg.root, p)); return `${p}\0${st.mtimeMs}\0${st.size}`; } catch { return p; } }).join("\n");
}

const cache = new Map<string, { stamp: string; index: CodeIndex | null }>();
/** The index, for the (synchronous) build: worked out in a child process,
 *  since the parsers load asynchronously, and kept until the code changes. */
export function codeIndexSync(cfg: Config): CodeIndex | null {
  if (!codeEnabled(cfg)) return null;
  const stamp = codeStamp(cfg);
  const hit = cache.get(cfg.root);
  if (hit?.stamp === stamp) return hit.index;
  const here = fileURLToPath(import.meta.url);
  const main = existsSync(join(dirname(here), "main.ts")) ? join(dirname(here), "main.ts") : here; // from source, or the bundle
  let index: CodeIndex | null = null;
  try {
    const out = execFileSync(process.execPath, [main, "-C", cfg.root, "__index-code"], { encoding: "utf8", maxBuffer: 256 << 20, stdio: ["ignore", "pipe", "pipe"] });
    index = out.trim() ? (JSON.parse(out) as CodeIndex) : null;
  } catch (err) {
    console.error(`rdstudio: indexing the code failed: ${(err as Error).message.split("\n")[0]}`);
  }
  cache.set(cfg.root, { stamp, index });
  return index;
}
