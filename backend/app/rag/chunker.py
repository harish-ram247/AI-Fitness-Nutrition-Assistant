import re
from dataclasses import dataclass


@dataclass
class TextChunk:
    content: str
    section_title: str | None
    chunk_index: int
    content_length: int


class RecursiveMarkdownChunker:
    """Chunks Markdown documents preserving section structure and token targets."""

    def __init__(
        self,
        chunk_size: int = 512,
        chunk_overlap: int = 64,
        min_chunk_size: int = 10,
    ) -> None:
        # Approximate 1 token ~= 4 characters in English
        self.char_chunk_size = chunk_size * 4
        self.char_overlap = chunk_overlap * 4
        self.char_min_size = min_chunk_size * 4

    def chunk_document(self, text: str) -> list[TextChunk]:
        if not text.strip():
            return []

        # Parse sections based on markdown headings
        sections = self._split_by_markdown_headings(text)
        all_chunks: list[TextChunk] = []
        chunk_index = 0

        for section_title, section_content in sections:
            section_chunks = self._chunk_text(section_content)
            for chunk_text in section_chunks:
                # Retain chunks that meet min size,
                # or if section has title and content, or first chunk
                if (
                    len(chunk_text.strip()) >= self.char_min_size
                    or bool(section_title and chunk_text.strip())
                    or not all_chunks
                ):
                    all_chunks.append(
                        TextChunk(
                            content=chunk_text.strip(),
                            section_title=section_title,
                            chunk_index=chunk_index,
                            content_length=len(chunk_text.strip()),
                        )
                    )
                    chunk_index += 1

        return all_chunks

    def _split_by_markdown_headings(self, text: str) -> list[tuple[str | None, str]]:
        heading_regex = re.compile(r"^(#{1,4}\s+.+)$", re.MULTILINE)
        splits = heading_regex.split(text)

        sections: list[tuple[str | None, str]] = []
        current_title: str | None = None

        i = 0
        while i < len(splits):
            part = splits[i]
            if heading_regex.match(part):
                # Clean header formatting (strip '#')
                current_title = re.sub(r"^#+\s*", "", part).strip()
                content = splits[i + 1] if i + 1 < len(splits) else ""
                sections.append((current_title, content))
                i += 2
            else:
                if part.strip():
                    sections.append((current_title, part))
                i += 1

        if not sections and text.strip():
            sections.append((None, text))

        return sections

    def _chunk_text(self, text: str) -> list[str]:
        text = text.strip()
        if len(text) <= self.char_chunk_size:
            return [text] if text else []

        # Split by double newline (paragraphs), then single newline, then sentences
        separators = ["\n\n", "\n", ". ", " "]
        return self._recursive_split(text, separators)

    def _recursive_split(self, text: str, separators: list[str]) -> list[str]:
        if len(text) <= self.char_chunk_size or not separators:
            return [text] if text else []

        sep = separators[0]
        splits = text.split(sep)
        chunks: list[str] = []
        current_chunk: list[str] = []
        current_len = 0

        for part in splits:
            part_len = len(part) + len(sep)
            if current_len + part_len > self.char_chunk_size and current_chunk:
                merged = sep.join(current_chunk)
                chunks.append(merged)
                # Apply overlap by keeping tail elements
                overlap_len = 0
                overlap_parts: list[str] = []
                for p in reversed(current_chunk):
                    if overlap_len + len(p) <= self.char_overlap:
                        overlap_parts.insert(0, p)
                        overlap_len += len(p) + len(sep)
                    else:
                        break
                current_chunk = overlap_parts
                current_len = overlap_len

            if len(part) > self.char_chunk_size and len(separators) > 1:
                sub_chunks = self._recursive_split(part, separators[1:])
                chunks.extend(sub_chunks[:-1])
                if sub_chunks:
                    current_chunk = [sub_chunks[-1]]
                    current_len = len(sub_chunks[-1])
            else:
                current_chunk.append(part)
                current_len += part_len

        if current_chunk:
            chunks.append(sep.join(current_chunk))

        return [c.strip() for c in chunks if c.strip()]
