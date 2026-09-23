from rdstudio.okf import Bundle
from rdstudio.search import Index, tokenize


def test_tokenize():
    assert tokenize("The Random Matrices of networks") == ["random", "matrice", "network"]


def test_ranking_and_filters(bundle_dir):
    idx = Index(Bundle.load(bundle_dir))
    hits = idx.search("random matrix spectrum")
    assert hits[0].concept.id == "research/spectrum"
    assert "circular law" in hits[0].snippet.lower() or hits[0].snippet
    assert [h.concept.id for h in idx.search("random", type="Design")] == ["design/model"]
    assert [h.concept.id for h in idx.search("random", tags=["rmt"])] == ["research/spectrum"]
    assert all(h.concept.id.startswith("design/") for h in idx.search("model", under="design"))
    assert idx.search("zzzz") == []
    assert set(hits[0].as_dict()) >= {"id", "title", "description", "score", "snippet"}
