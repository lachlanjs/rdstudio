import os
import subprocess
import sys

from rdstudio import launcher

RUN = [sys.executable, "-c", "from rdstudio.launcher import main; main()"]


def test_a_checkout_runs_the_typescript_sources_with_the_bundled_node():
    assert launcher.program() == launcher.SOURCE  # this repository, with node_modules installed
    node = launcher.node_executable()
    assert node and os.path.exists(node)
    out = subprocess.run([*RUN, "--version"], capture_output=True, text=True, check=True)
    assert out.stdout.strip() == "rdstudio 0.1.0"


def test_the_python_command_line_is_still_there():
    env = {**os.environ, "RDSTUDIO_PYTHON": "1"}
    out = subprocess.run([*RUN, "--version"], capture_output=True, text=True, env=env)
    assert out.returncode == 0 and out.stdout.strip() == "rdstudio 0.1.0"
    out = subprocess.run([*RUN, "check", "--help"], capture_output=True, text=True, env=env)
    assert "--warnings" in out.stdout  # argparse's help: the Python command line answered


def test_node_output_matches_python(tmp_path):
    (tmp_path / "knowledge").mkdir()
    (tmp_path / "rdstudio.toml").write_text("[project]\ntitle = 'T'\n")
    (tmp_path / "knowledge" / "a.md").write_text("---\ntype: Concept\n---\nSee [b](/b.md).\n")
    node = subprocess.run([*RUN, "check", "-w"], cwd=tmp_path, capture_output=True, text=True)
    py = subprocess.run([*RUN, "check", "-w"], cwd=tmp_path, capture_output=True, text=True,
                        env={**os.environ, "RDSTUDIO_PYTHON": "1"})
    assert (node.returncode, node.stdout) == (py.returncode, py.stdout)
    assert "broken link to b" in node.stdout
