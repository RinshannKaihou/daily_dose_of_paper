#!/usr/bin/env python3
"""
Fetch papers from arxiv based on configuration.
"""

import argparse
import json
import os
import ssl
import sys
import urllib.request
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple

import arxiv
import requests

# Fix SSL certificate verification issue on macOS
ssl._create_default_https_context = ssl._create_unverified_context


def load_config(config_path: str) -> Dict[str, Any]:
    """Load configuration from JSON file."""
    with open(config_path, 'r') as f:
        return json.load(f)


def load_seen_ids(papers_dir: str) -> set:
    """Load set of already downloaded paper IDs from global tracking file."""
    seen_file = Path(papers_dir) / "seen_paper_ids.json"
    if seen_file.exists():
        with open(seen_file, 'r') as f:
            return set(json.load(f))
    return set()


def save_seen_ids(papers_dir: str, seen_ids: set) -> None:
    """Save seen paper IDs to global tracking file."""
    seen_file = Path(papers_dir) / "seen_paper_ids.json"
    seen_file.parent.mkdir(parents=True, exist_ok=True)
    with open(seen_file, 'w') as f:
        json.dump(list(seen_ids), f, indent=2)


def load_tracked_ids_from_metadata(papers_dir: str) -> set:
    """Load paper IDs that still exist in metadata files."""
    root = Path(papers_dir)
    tracked = set()
    if not root.exists():
        return tracked

    for metadata_path in root.glob("*/metadata.json"):
        try:
            with open(metadata_path, 'r') as f:
                papers = json.load(f)
            for paper in papers:
                paper_id = paper.get("id")
                if paper_id:
                    tracked.add(paper_id)
        except (json.JSONDecodeError, IOError, TypeError):
            continue

    return tracked


def build_query(
    search_queries: List[str],
    categories: List[str],
    submitted_range: Optional[Tuple[datetime, datetime]] = None,
) -> str:
    """Build arxiv search query from config."""
    # Combine search terms with OR using arXiv's broad field query.
    # Relevance is later improved by category/date filtering.
    query_parts = []
    for q in search_queries:
        q = q.strip()
        if not q:
            continue
        safe_q = q.replace('"', "")
        tokens = [t.replace('"', "") for t in safe_q.split() if t.strip()]

        # Use phrase OR token-conjunction to avoid over-restricting multi-word topics.
        # Example: "LLM training stability" ->
        # (all:"LLM training stability" OR (all:"LLM" AND all:"training" AND all:"stability"))
        if len(tokens) >= 2:
            token_clause = " AND ".join([f'all:"{t}"' for t in tokens])
            query_parts.append(f'(all:"{safe_q}" OR ({token_clause}))')
        else:
            query_parts.append(f'(all:"{safe_q}")')

    query = " OR ".join(query_parts)

    # Add category filter if specified
    if categories:
        cat_filter = " OR ".join([f"cat:{c}" for c in categories])
        query = f"({query}) AND ({cat_filter})" if query else f"({cat_filter})"

    if submitted_range:
        submitted_start, submitted_end = submitted_range
        start_token = submitted_start.strftime("%Y%m%d0000")
        end_token = submitted_end.strftime("%Y%m%d2359")
        date_filter = f"submittedDate:[{start_token} TO {end_token}]"
        query = f"({query}) AND {date_filter}" if query else date_filter

    if not query:
        raise ValueError("At least one search query or category is required.")

    return query


def get_date_range(date_range: str, specific_date: str = None) -> tuple:
    """Get start and end dates based on range setting."""
    if specific_date:
        # When fetching for a specific folder date, treat it as the range anchor.
        end_date = datetime.strptime(specific_date, "%Y-%m-%d").replace(
            hour=23, minute=59, second=59, microsecond=999999
        )
    else:
        end_date = datetime.now()

    day_map = {
        "last1day": 1,
        "last3days": 3,
        "last7days": 7,
        "last30days": 30,
    }

    start_date = end_date - timedelta(days=day_map.get(date_range, 7))

    return start_date, end_date


def fetch_papers(config: Dict[str, Any], output_dir: str, papers_dir: str, specific_date: str = None) -> List[Dict]:
    """Fetch papers from arxiv based on config.

    Args:
        config: Configuration dictionary
        output_dir: Directory for this specific date's papers
        papers_dir: Root papers directory (for global tracking)
        specific_date: Optional specific date string
    """
    start_date, end_date = get_date_range(config.get('date_range', 'last7days'), specific_date)
    start_day = start_date.date()
    end_day = end_date.date()
    query = build_query(
        config['search_queries'],
        config.get('categories', []),
        (start_date, end_date),
    )
    max_results = config.get('max_papers_per_day', 10)
    # Fetch a deeper candidate pool because global de-dup and date filtering can skip many items.
    search_limit = max(max_results * 25, 1000)

    # Load globally seen paper IDs
    seen_ids = load_seen_ids(papers_dir)
    tracked_ids = load_tracked_ids_from_metadata(papers_dir)
    if seen_ids != tracked_ids:
        stale = len(seen_ids - tracked_ids)
        missing = len(tracked_ids - seen_ids)
        print(f"Reconciling seen IDs with metadata (drop stale={stale}, restore missing={missing})")
        seen_ids = tracked_ids
    print(f"Previously seen papers (from metadata): {len(seen_ids)}")

    print(f"Searching arxiv with query: {query}")
    print(f"Max results: {max_results}")
    print(f"Date range (published): {start_day} to {end_day}")
    print(f"Candidate search limit: {search_limit}")

    search = arxiv.Search(
        query=query,
        max_results=search_limit,
        sort_by=arxiv.SortCriterion.SubmittedDate,
        sort_order=arxiv.SortOrder.Descending,
    )

    papers = []
    skipped = 0
    skipped_out_of_range = 0

    for result in search.results():
        published_day = result.published.date()

        # Enforce configured date range by paper publication date.
        if published_day < start_day or published_day > end_day:
            skipped_out_of_range += 1
            continue

        paper_id = result.entry_id.split("/")[-1]

        # Skip if already seen
        if paper_id in seen_ids:
            print(f"Skipping duplicate: {paper_id}")
            skipped += 1
            continue

        paper = {
            "id": paper_id,
            "title": result.title,
            "authors": [author.name for author in result.authors],
            "summary": result.summary.replace("\n", " ").strip(),
            "published": result.published.isoformat(),
            "arxiv_url": result.entry_id,
            "pdf_path": None,
            "analysis_path": None,
            "categories": list(result.categories),
        }

        papers.append(paper)
        seen_ids.add(paper_id)

        # Stop if we have enough new papers
        if len(papers) >= max_results:
            break

    # Check existing metadata
    metadata_path = Path(output_dir) / "metadata.json"
    existing_papers = []
    removed_existing_out_of_range = 0
    if metadata_path.exists():
        try:
            with open(metadata_path, 'r') as f:
                existing_papers = json.load(f)
        except (json.JSONDecodeError, IOError):
            existing_papers = []

    # Keep existing entries only if they still match current date filter.
    filtered_existing = []
    for paper in existing_papers:
        published_raw = paper.get("published")
        if not published_raw:
            filtered_existing.append(paper)
            continue

        try:
            published_day = datetime.fromisoformat(published_raw.replace("Z", "+00:00")).date()
            if start_day <= published_day <= end_day:
                filtered_existing.append(paper)
            else:
                removed_existing_out_of_range += 1
        except ValueError:
            filtered_existing.append(paper)

    existing_papers = filtered_existing

    # If no new papers and no existing papers, don't create anything
    if len(papers) == 0 and len(existing_papers) == 0 and removed_existing_out_of_range == 0:
        print(f"\nNo new papers found (skipped {skipped} duplicates, {skipped_out_of_range} out of range)")
        print("No existing papers for this date. Try a different date or modify search queries.")
        return []

    # Only create directories if we have papers to save
    if len(papers) > 0:
        pdf_dir = Path(output_dir) / "pdfs"
        pdf_dir.mkdir(parents=True, exist_ok=True)

        # Download PDFs for new papers
        for paper in papers:
            # Re-fetch from arxiv to download (we only stored metadata above)
            try:
                print(f"Downloading PDF for {paper['id']}...")
                search_dl = arxiv.Search(id_list=[paper['id']])
                result = list(search_dl.results())[0]
                pdf_path = pdf_dir / f"{paper['id']}.pdf"
                result.download_pdf(dirpath=str(pdf_dir), filename=f"{paper['id']}.pdf")
                paper["pdf_path"] = str(pdf_path)
                print(f"Downloaded: {pdf_path}")
            except Exception as e:
                print(f"Failed to download PDF for {paper['id']}: {e}")

    # Merge: keep existing papers and add new ones (by ID)
    existing_ids = {p['id'] for p in existing_papers}
    all_papers = existing_papers.copy()
    for paper in papers:
        if paper['id'] not in existing_ids:
            all_papers.append(paper)

    # Ensure output directory exists before saving metadata
    Path(output_dir).mkdir(parents=True, exist_ok=True)

    with open(metadata_path, 'w') as f:
        json.dump(all_papers, f, indent=2, ensure_ascii=False)

    # Save updated seen IDs globally
    save_seen_ids(papers_dir, seen_ids)

    print(
        f"\nFetched {len(papers)} new papers "
        f"(skipped {skipped} duplicates, {skipped_out_of_range} out of range, "
        f"removed {removed_existing_out_of_range} stale existing)"
    )
    print(f"Total papers in metadata: {len(all_papers)}")
    print(f"Metadata saved to: {metadata_path}")

    return all_papers


def main():
    parser = argparse.ArgumentParser(description="Fetch papers from arxiv")
    parser.add_argument("--config", required=True, help="Path to config.json")
    parser.add_argument("--output", required=True, help="Output directory for this date")
    parser.add_argument("--papers-dir", required=True, help="Root papers directory for global tracking")
    parser.add_argument("--date", help="Specific date (YYYY-MM-DD)")

    args = parser.parse_args()

    config = load_config(args.config)
    papers = fetch_papers(config, args.output, args.papers_dir, args.date)

    print(f"\nDone! Fetched {len(papers)} new papers.")


if __name__ == "__main__":
    main()
