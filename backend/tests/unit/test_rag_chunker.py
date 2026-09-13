from app.rag.chunker import RecursiveMarkdownChunker


def test_chunker_empty_input() -> None:
    chunker = RecursiveMarkdownChunker()
    assert chunker.chunk_document("") == []
    assert chunker.chunk_document("   \n\n  ") == []


def test_chunker_single_short_document() -> None:
    chunker = RecursiveMarkdownChunker()
    text = "# Introduction\n\nThis is a short document about macronutrients."
    chunks = chunker.chunk_document(text)

    assert len(chunks) == 1
    assert chunks[0].section_title == "Introduction"
    assert "macronutrients" in chunks[0].content
    assert chunks[0].chunk_index == 0


def test_chunker_multiple_markdown_sections() -> None:
    chunker = RecursiveMarkdownChunker(chunk_size=100, chunk_overlap=20, min_chunk_size=10)
    text = (
        "# Resistance Training Principles\n\n"
        "Progressive overload is the gradual increase of stress placed upon the body "
        "during exercise training.\n\n"
        "## Hypertrophy Volume Guidelines\n\n"
        "Research suggests 10 to 20 sets per muscle group per week provides an optimal "
        "stimulus for muscle growth.\n\n"
        "## Recovery and Sleep\n\n"
        "Adequate sleep of 7 to 9 hours per night facilitates tissue repair and hormonal balance.\n"
    )
    chunks = chunker.chunk_document(text)

    assert len(chunks) >= 3
    section_titles = [c.section_title for c in chunks]
    assert "Resistance Training Principles" in section_titles
    assert "Hypertrophy Volume Guidelines" in section_titles
    assert "Recovery and Sleep" in section_titles

    # Index ordering check
    for idx, c in enumerate(chunks):
        assert c.chunk_index == idx
