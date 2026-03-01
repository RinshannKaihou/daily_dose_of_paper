#!/usr/bin/env python3
"""
Parse PDF files to extract text content.
"""

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Optional

from PyPDF2 import PdfReader


def extract_text_from_pdf(pdf_path: str) -> str:
    """Extract text content from a PDF file."""
    try:
        reader = PdfReader(pdf_path)
        text_parts = []

        for i, page in enumerate(reader.pages):
            text = page.extract_text()
            if text:
                text_parts.append(f"--- Page {i + 1} ---\n{text}")

        return "\n\n".join(text_parts)
    except Exception as e:
        print(f"Error extracting text from {pdf_path}: {e}")
        return ""


def parse_pdfs_in_directory(directory: str) -> dict:
    """Parse all PDFs in a directory and save extracted text."""
    dir_path = Path(directory)
    pdf_dir = dir_path / "pdfs"
    text_dir = dir_path / "pdf_text"
    text_dir.mkdir(exist_ok=True)

    # Load metadata
    metadata_path = dir_path / "metadata.json"
    if not metadata_path.exists():
        print(f"No metadata.json found in {directory}")
        return {}

    with open(metadata_path, 'r') as f:
        papers = json.load(f)

    results = {}

    for paper in papers:
        paper_id = paper['id']
        pdf_path = pdf_dir / f"{paper_id}.pdf"

        if pdf_path.exists():
            print(f"Parsing {paper_id}...")
            text = extract_text_from_pdf(str(pdf_path))

            # Save extracted text
            text_path = text_dir / f"{paper_id}.txt"
            with open(text_path, 'w', encoding='utf-8') as f:
                f.write(text)

            results[paper_id] = str(text_path)
            print(f"Saved text to {text_path}")
        else:
            print(f"PDF not found for {paper_id}")

    return results


def main():
    parser = argparse.ArgumentParser(description="Parse PDF files to extract text")
    parser.add_argument("--dir", required=True, help="Directory containing papers")

    args = parser.parse_args()

    results = parse_pdfs_in_directory(args.dir)

    print(f"\nParsed {len(results)} PDFs")


if __name__ == "__main__":
    main()
