from __future__ import annotations

from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter


def build_resume_splitter() -> RecursiveCharacterTextSplitter:
    """Build a general-purpose splitter for resume text."""
    return RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200,
        length_function=len,
        separators=["\n\n", "\n", " ", ""],
        is_separator_regex=False,
    )


def split_resume_documents(documents: list[Document]) -> list[Document]:
    """Split loaded resume pages into retrievable chunks."""
    splitter = build_resume_splitter()
    return splitter.split_documents(documents)
