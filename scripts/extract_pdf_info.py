#!/usr/bin/env python3
"""
Extract metadata and optional text from a PDF file using PyPDF2.
Prints a JSON object to stdout.
"""

import argparse
import json
import re
import sys
from typing import Any

from PyPDF2 import PdfReader


def normalize_authors(author_value: str | None) -> list[str]:
    if not author_value:
        return []

    raw = author_value.strip()
    if not raw:
        return []

    parts = re.split(r";|,|\n|\band\b", raw, flags=re.IGNORECASE)
    authors = [part.strip() for part in parts if part and part.strip()]
    return authors


def extract_info(pdf_path: str, include_text: bool) -> dict[str, Any]:
    try:
        reader = PdfReader(pdf_path)
        metadata = reader.metadata or {}

        title = metadata.get("/Title") or metadata.get("title")
        author_field = metadata.get("/Author") or metadata.get("author")
        authors = normalize_authors(author_field)

        text_parts: list[str] = []
        first_non_empty_line: str | None = None

        for page in reader.pages:
            page_text = page.extract_text() or ""
            if page_text and first_non_empty_line is None:
                lines = [line.strip() for line in page_text.splitlines() if line.strip()]
                if lines:
                    first_non_empty_line = lines[0][:200]
            if include_text and page_text:
                text_parts.append(page_text)

        if not title:
            title = first_non_empty_line

        return {
            "ok": True,
            "title": title if title else None,
            "authors": authors,
            "text": "\n\n".join(text_parts) if include_text else None,
            "error": None,
        }
    except Exception as exc:
        return {
            "ok": False,
            "title": None,
            "authors": [],
            "text": None,
            "error": str(exc),
        }


def main() -> int:
    parser = argparse.ArgumentParser(description="Extract metadata/text from a PDF file")
    parser.add_argument("--pdf", required=True, help="Path to PDF file")
    parser.add_argument(
        "--include-text",
        action="store_true",
        help="Include extracted full text in output JSON",
    )
    args = parser.parse_args()

    result = extract_info(args.pdf, args.include_text)
    print(json.dumps(result, ensure_ascii=False))
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
