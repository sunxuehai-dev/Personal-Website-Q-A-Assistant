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


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Ingest a resume PDF into the local Chroma knowledge base.")
    parser.add_argument(
        "pdf_path",
        type=str,
        help="Path to the resume PDF file to ingest.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    Settings.ensure_directories()

    source_path = Path(args.pdf_path).expanduser().resolve()
    if not source_path.exists():
        raise FileNotFoundError(f"Source resume file not found: {source_path}")

    target_path = Settings.RESUME_DIR / source_path.name
    if source_path != target_path:
        shutil.copy2(source_path, target_path)

    pipeline = ResumeIngestionPipeline()
    result = pipeline.ingest(target_path.name)

    print("Ingestion completed successfully.")
    print(f"File: {result['file_name']}")
    print(f"Chunks: {result['chunk_count']}")
    print(f"Collection: {result['collection_name']}")


if __name__ == "__main__":
    main()
