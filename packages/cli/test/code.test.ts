import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { expect, test } from "vitest";
import { codeEnabled, indexCode } from "../src/code.ts";
import { loadConfig } from "../src/config.ts";

const put = (root: string, rel: string, text: string) => {
  mkdirSync(dirname(join(root, rel)), { recursive: true });
  writeFileSync(join(root, rel), text);
};

// A small codebase: a C++ class bound to Python by nanobind, Python using it, a test, and a CMake target.
function project(toml: string) {
  const root = mkdtempSync(join(tmpdir(), "rdstudio-code-"));
  put(root, "rdstudio.toml", toml);
  put(root, "CMakeLists.txt", "nanobind_add_module(_core src/bind.cpp src/body.cpp)\n");
  put(root, "src/body.hpp", "#pragma once\nnamespace sim {\n/// A point mass.\nclass Body {\n public:\n  double energy() const;\n  double mass = 1;\n};\nconstexpr double G = 1.0;\n}\n");
  put(root, "src/body.cpp", '#include "body.hpp"\nnamespace sim {\ndouble Body::energy() const { return mass * G; }\n}\n');
  put(root, "src/bind.cpp", '#include <nanobind/nanobind.h>\n#include "body.hpp"\nnamespace nb = nanobind;\nNB_MODULE(_core, m) {\n  nb::class_<sim::Body>(m, "Body").def("energy", &sim::Body::energy);\n}\n');
  put(root, "pkg/__init__.py", "");
  put(root, "pkg/model.py", 'from . import _core\n\nSTEPS = 10\n\n\nclass Model:\n    """Wraps a body."""\n\n    def run(self):\n        b = _core.Body()\n        return helper(b)\n\n\ndef helper(b):\n    return b.energy()\n');
  put(root, "tests/test_model.py", "from pkg.model import Model\n\n\ndef test_run():\n    assert Model().run() > 0\n");
  put(root, "knowledge/index.md", "---\nokf_version: \"0.2\"\n---\n");
  execFileSync("git", ["init", "-q"], { cwd: root });
  execFileSync("git", ["add", "-A"], { cwd: root });
  return root;
}

test("code is mapped for codebases and projects, or when asked", () => {
  expect(codeEnabled(loadConfig(project('[teacher]\nprofile = "topic"\n')))).toBe(false);
  expect(codeEnabled(loadConfig(project('[teacher]\nprofile = "codebase"\n')))).toBe(true);
  expect(codeEnabled(loadConfig(project('[teacher]\nprofile = "topic"\n\n[code]\nenabled = true\n')))).toBe(true);
});

test("the index reads directories down to methods, fields and constants, with links across the binding", async () => {
  const idx = (await indexCode(loadConfig(project('[teacher]\nprofile = "codebase"\n'))))!;
  const ids = new Set(idx.items.map((i) => i.id));
  const kind = (id: string) => idx.items.find((i) => i.id === id)?.kind;
  expect(kind("src/")).toBe("dir");
  expect(kind("src/body.hpp")).toBe("file");
  expect(kind("src/body.hpp#sim::Body")).toBe("class");
  expect(kind("src/body.hpp#sim::Body::energy")).toBe("method");
  expect(kind("src/body.hpp#sim::Body::mass")).toBe("field");
  expect(kind("src/body.hpp#sim::G")).toBe("constant");
  expect(kind("pkg/model.py#Model.run")).toBe("method");
  expect(kind("pkg/model.py#STEPS")).toBe("constant");
  expect(kind("CMakeLists.txt#_core")).toBe("target");
  expect(ids.has("knowledge/index.md")).toBe(false); // notes are not code
  const has = (a: string, b: string, k: string) => idx.links.some(([x, y, z]) => x === a && y === b && z === k);
  expect(idx.items.find((i) => i.id === "src/body.hpp#sim::Body")!.doc).toBe("A point mass.");
  expect(idx.items.find((i) => i.id === "src/body.hpp#sim::Body")!.bound).toBe("Body");
  expect(has("src/body.cpp#sim::Body::energy", "src/body.hpp#sim::Body::energy", "implements")).toBe(true);
  expect(has("src/bind.cpp", "src/body.hpp", "includes")).toBe(true);
  expect(has("pkg/model.py#Model.run", "src/body.hpp#sim::Body", "calls")).toBe(true); // _core.Body, through the binding
  expect(has("pkg/model.py#Model.run", "pkg/model.py#helper", "calls")).toBe(true);
  expect(has("tests/test_model.py#test_run", "pkg/model.py#Model", "tests")).toBe(true);
  expect(has("tests/test_model.py", "pkg/model.py", "imports")).toBe(true);
  expect(has("CMakeLists.txt#_core", "src/body.cpp", "builds")).toBe(true);
});
