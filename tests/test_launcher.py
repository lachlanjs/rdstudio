import os
import subprocess
import sys

from rdstudio import __version__, launcher

RUN = [sys.executable, "-c", "from rdstudio.launcher import main; main()"]


def test_a_checkout_runs_the_typescript_sources_with_the_bundled_node():
    assert launcher.program() == launcher.SOURCE  # this repository, with node_modules installed
    node = launcher.node_executable()
    assert node and os.path.exists(node)
    out = subprocess.run([*RUN, "--version"], capture_output=True, text=True, check=True)
    assert out.stdout.strip() == f"rdstudio {__version__}"


def test_without_the_node_program_it_says_how_to_get_it(tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(launcher, "SOURCE", tmp_path / "main.ts")
    monkeypatch.setattr(launcher, "BUNDLE", tmp_path / "rdstudio.mjs")
    try:
        launcher.main()
    except SystemExit as stop:
        assert "Node program is missing" in str(stop.code) and "npx rdstudio" in str(stop.code)
    else:
        raise AssertionError("it went on with no program to run")


def test_a_project_is_checked_through_it(tmp_path):
    (tmp_path / "knowledge").mkdir()
    (tmp_path / "rdstudio.toml").write_text("[project]\ntitle = 'T'\n")
    (tmp_path / "knowledge" / "a.md").write_text("---\ntype: Concept\n---\nSee [b](/b.md).\n")
    out = subprocess.run([*RUN, "check", "-w"], cwd=tmp_path, capture_output=True, text=True)
    assert "broken link to b" in out.stdout
