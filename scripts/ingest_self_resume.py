from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.core.config import Settings
from app.ingestion.pipeline import ResumeIngestionPipeline


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Ingest a source PDF into the persistent self_resume knowledge base."
    )
    parser.add_argument(
        "--pdf-path",
        type=str,
        required=True,
        help="Absolute or relative path to the source resume PDF.",
    )
    return parser.parse_args(argv)


def reset_self_resume_storage() -> None:
    Settings.ensure_directories()

    for file in Settings.SELF_RESUME_DIR.glob("*.pdf"):
        file.unlink(missing_ok=True)

    if Settings.SELF_RESUME_CHROMA_DIR.exists():
        shutil.rmtree(Settings.SELF_RESUME_CHROMA_DIR)
    Settings.SELF_RESUME_CHROMA_DIR.mkdir(parents=True, exist_ok=True)


def resolve_target_pdf(pdf_path: str) -> Path:
    source_path = Path(pdf_path).expanduser().resolve()
    if not source_path.exists():
        raise FileNotFoundError(f"Source resume file not found: {source_path}")
    if source_path.suffix.lower() != ".pdf":
        raise ValueError(f"Only PDF files are supported: {source_path}")

    reset_self_resume_storage()

    target_path = Settings.SELF_RESUME_DIR / source_path.name
    if source_path != target_path:
        shutil.copy2(source_path, target_path)
    return target_path


def main() -> None:
    args = parse_args()
    target_pdf = resolve_target_pdf(args.pdf_path)

    pipeline = ResumeIngestionPipeline(
        resume_dir=Settings.SELF_RESUME_DIR,
        persist_directory=Settings.SELF_RESUME_CHROMA_DIR,
        collection_name=Settings.SELF_RESUME_COLLECTION_NAME,
        doc_type="self_resume",
    )
    result = pipeline.ingest(target_pdf.name)

    print("Self resume ingestion completed successfully.")
    print("Rebuilt self_resume storage from scratch.")
    print(f"File: {result['file_name']}")
    print(f"Chunks: {result['chunk_count']}")
    print(f"Collection: {result['collection_name']}")


if __name__ == "__main__":
    main()
