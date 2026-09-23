import asyncio
import shutil

import pytest

from rdstudio import config, references
from rdstudio.mcp_server import create_server
from rdstudio.okf import Bundle

from .conftest import write


@pytest.fixture
def ref_project(tmp_path, bundle_dir):
    lib = tmp_path / "papis"
    write(lib, "a1/info.yaml", """ref: clark2024coupled
title: Theory of Coupled Neuronal-Synaptic Dynamics
author_list: [{family: Clark, given: David G.}, {family: Abbott, given: L. F.}]
year: 2024
journal: Physical Review X
doi: 10.1103/physrevx.14.021001
tags: [dmft, plasticity]
""")
    write(lib, "b2/info.yaml", "ref: sompolinsky1988chaos\ntitle: Chaos in Random Neural Networks\nauthor: Sompolinsky, H. and Crisanti, A. and Sommers, H. J.\nyear: 1988\n")
    root = bundle_dir.parent
    write(root, "rdstudio.toml", f'[references]\nbackend = "papis"\npath = "{lib}"\n')
    return config.load(root)


def test_sync_search(ref_project):
    cfg = ref_project
    assert sorted(references.sync_stubs(cfg)) == ["references/clark2024coupled", "references/sompolinsky1988chaos"]
    assert references.sync_stubs(cfg) == []
    c = Bundle.load(cfg.knowledge_dir).concepts["references/clark2024coupled"]
    assert c.type == "Reference" and c.meta["resource"] == "https://doi.org/10.1103/physrevx.14.021001"
    assert c.description == "Clark and Abbott (2024). Theory of Coupled Neuronal-Synaptic Dynamics. Physical Review X."
    assert c.generated["by"] == "process:rdstudio-refs"
    hits = references.search(cfg, "chaos random networks")
    assert hits[0]["ref"] == "sompolinsky1988chaos" and hits[0]["authors"][0] == "Sompolinsky, H."


def test_no_pdf_and_mcp(ref_project):
    with pytest.raises(references.ReferenceError):
        references.text(ref_project, "clark2024coupled")
    server = create_server(ref_project)
    names = {t.name for t in asyncio.run(server.list_tools())}
    assert {"ref_search", "ref_text"} <= names


@pytest.mark.skipif(not shutil.which("pdftotext"), reason="needs poppler")
def test_pdf_text(ref_project, tmp_path):
    import subprocess
    lib = references.library_path(ref_project)
    pdf = lib / "a1" / "paper.pdf"
    # A two-page PDF built by hand: page 2 mentions "synaptic".
    objs = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>",
            "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Contents 4 0 R /Resources << /Font << /F1 7 0 R >> >> >>",
            None, "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Contents 6 0 R /Resources << /Font << /F1 7 0 R >> >> >>",
            None, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"]
    streams = {4: "BT /F1 12 Tf 20 200 Td (Introduction to chaos) Tj ET", 6: "BT /F1 12 Tf 20 200 Td (synaptic dynamics result) Tj ET"}
    out, offsets = b"%PDF-1.4\n", []
    for i, body in enumerate(objs, start=1):
        offsets.append(len(out))
        if body is None:
            s = streams[i].encode()
            out += f"{i} 0 obj << /Length {len(s)} >> stream\n".encode() + s + b"\nendstream endobj\n"
        else:
            out += f"{i} 0 obj {body} endobj\n".encode()
    xref = len(out)
    out += f"xref\n0 {len(objs) + 1}\n0000000000 65535 f \n".encode() + b"".join(f"{o:010d} 00000 n \n".encode() for o in offsets)
    out += f"trailer << /Size {len(objs) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()
    pdf.write_bytes(out)
    info = lib / "a1" / "info.yaml"
    info.write_text(info.read_text() + "files: [paper.pdf]\n")
    assert "synaptic dynamics" in references.text(ref_project, "clark2024coupled", query="synaptic")
    assert "page 1 of 2" in references.text(ref_project, "clark2024coupled", pages="1")
