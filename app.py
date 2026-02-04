#!/usr/bin/env python3
"""
FastAPI backend for the arXiv Scraper application.
Provides API endpoints to view, filter, and manage scraped papers.
"""

import os
import sys
import subprocess
import pandas as pd
from pathlib import Path
from datetime import datetime
from typing import Optional, List
from fastapi import FastAPI, HTTPException, Query, BackgroundTasks
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse
from pydantic import BaseModel
import logging

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Constants
RESULTS_FOLDER = "results"
STATIC_FOLDER = "static"

app = FastAPI(
    title="arXiv Paper Scraper",
    description="A web interface for scraping and evaluating arXiv papers for startup viability",
    version="1.0.0"
)

# Mount static files
app.mount("/static", StaticFiles(directory=STATIC_FOLDER), name="static")


# Pydantic models
class Paper(BaseModel):
    id: str
    title: str
    categories: str
    abstract: str
    doi: Optional[str] = None
    created: Optional[str] = None
    updated: Optional[str] = None
    authors: str
    score: Optional[float] = None
    reasoning: Optional[str] = None


class PapersResponse(BaseModel):
    papers: List[Paper]
    total: int
    page: int
    per_page: int
    total_pages: int


class StatsResponse(BaseModel):
    total_papers: int
    evaluated_papers: int
    average_score: Optional[float]
    categories: dict
    score_distribution: dict
    last_scrape: Optional[str]


class TaskStatus(BaseModel):
    status: str
    message: str


# Background task tracking
task_status = {"scraper": None, "evaluator": None}


def get_csv_files():
    """Get all CSV files in the results directory."""
    results_path = Path(RESULTS_FOLDER)
    if not results_path.exists():
        return []
    return sorted(results_path.glob("*.csv"), key=lambda x: x.stat().st_mtime, reverse=True)


def load_papers_df(evaluated_only: bool = False):
    """Load papers from CSV files."""
    csv_files = get_csv_files()

    if not csv_files:
        return pd.DataFrame()

    # Prefer evaluated file if it exists
    evaluated_file = Path(RESULTS_FOLDER) / "arxiv_papers_evaluated.csv"
    base_file = Path(RESULTS_FOLDER) / "arxiv_papers.csv"

    if evaluated_only and evaluated_file.exists():
        return pd.read_csv(evaluated_file)
    elif evaluated_file.exists():
        return pd.read_csv(evaluated_file)
    elif base_file.exists():
        return pd.read_csv(base_file)
    elif csv_files:
        return pd.read_csv(csv_files[0])

    return pd.DataFrame()


@app.get("/", response_class=HTMLResponse)
async def root():
    """Serve the main HTML page."""
    return FileResponse(os.path.join(STATIC_FOLDER, "index.html"))


@app.get("/api/papers", response_model=PapersResponse)
async def get_papers(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    category: Optional[str] = None,
    min_score: Optional[float] = Query(None, ge=0, le=10),
    max_score: Optional[float] = Query(None, ge=0, le=10),
    sort_by: str = Query("created", regex="^(created|updated|score|title)$"),
    sort_order: str = Query("desc", regex="^(asc|desc)$")
):
    """Get paginated list of papers with optional filtering."""
    df = load_papers_df()

    if df.empty:
        return PapersResponse(papers=[], total=0, page=page, per_page=per_page, total_pages=0)

    # Apply filters
    if search:
        search_lower = search.lower()
        mask = (
            df['title'].str.lower().str.contains(search_lower, na=False) |
            df['abstract'].str.lower().str.contains(search_lower, na=False) |
            df['authors'].str.lower().str.contains(search_lower, na=False)
        )
        df = df[mask]

    if category:
        df = df[df['categories'].str.contains(category, na=False)]

    if min_score is not None and 'score' in df.columns:
        df = df[df['score'] >= min_score]

    if max_score is not None and 'score' in df.columns:
        df = df[df['score'] <= max_score]

    # Sort
    if sort_by in df.columns:
        ascending = sort_order == "asc"
        df = df.sort_values(by=sort_by, ascending=ascending, na_position='last')

    # Pagination
    total = len(df)
    total_pages = (total + per_page - 1) // per_page
    start = (page - 1) * per_page
    end = start + per_page
    df_page = df.iloc[start:end]

    # Convert to list of Paper objects
    papers = []
    for _, row in df_page.iterrows():
        paper = Paper(
            id=str(row.get('id', '')),
            title=str(row.get('title', '')),
            categories=str(row.get('categories', '')),
            abstract=str(row.get('abstract', '')),
            doi=str(row.get('doi', '')) if pd.notna(row.get('doi')) else None,
            created=str(row.get('created', '')) if pd.notna(row.get('created')) else None,
            updated=str(row.get('updated', '')) if pd.notna(row.get('updated')) else None,
            authors=str(row.get('authors', '')),
            score=float(row.get('score', 0)) if pd.notna(row.get('score', None)) and 'score' in row else None,
            reasoning=str(row.get('reasoning', '')) if pd.notna(row.get('reasoning', None)) and 'reasoning' in row else None
        )
        papers.append(paper)

    return PapersResponse(
        papers=papers,
        total=total,
        page=page,
        per_page=per_page,
        total_pages=total_pages
    )


@app.get("/api/paper/{paper_id}")
async def get_paper(paper_id: str):
    """Get a single paper by ID."""
    df = load_papers_df()

    if df.empty:
        raise HTTPException(status_code=404, detail="No papers found")

    paper_row = df[df['id'] == paper_id]

    if paper_row.empty:
        raise HTTPException(status_code=404, detail="Paper not found")

    row = paper_row.iloc[0]
    return Paper(
        id=str(row.get('id', '')),
        title=str(row.get('title', '')),
        categories=str(row.get('categories', '')),
        abstract=str(row.get('abstract', '')),
        doi=str(row.get('doi', '')) if pd.notna(row.get('doi')) else None,
        created=str(row.get('created', '')) if pd.notna(row.get('created')) else None,
        updated=str(row.get('updated', '')) if pd.notna(row.get('updated')) else None,
        authors=str(row.get('authors', '')),
        score=float(row.get('score', 0)) if pd.notna(row.get('score', None)) and 'score' in row else None,
        reasoning=str(row.get('reasoning', '')) if pd.notna(row.get('reasoning', None)) and 'reasoning' in row else None
    )


@app.get("/api/stats", response_model=StatsResponse)
async def get_stats():
    """Get statistics about the scraped papers."""
    df = load_papers_df()

    if df.empty:
        return StatsResponse(
            total_papers=0,
            evaluated_papers=0,
            average_score=None,
            categories={},
            score_distribution={},
            last_scrape=None
        )

    # Count evaluated papers
    evaluated_count = 0
    avg_score = None
    score_dist = {}

    if 'score' in df.columns:
        evaluated_df = df[df['score'] > 0]
        evaluated_count = len(evaluated_df)
        if evaluated_count > 0:
            avg_score = round(evaluated_df['score'].mean(), 2)
            # Score distribution
            for i in range(1, 11):
                score_dist[str(i)] = int(((evaluated_df['score'] >= i) & (evaluated_df['score'] < i + 1)).sum())

    # Category distribution
    categories = {}
    for cats in df['categories'].dropna():
        for cat in str(cats).split():
            cat_main = cat.split('.')[0]
            categories[cat_main] = categories.get(cat_main, 0) + 1

    # Last scrape time
    last_scrape = None
    last_update_file = Path("last_update.txt")
    if last_update_file.exists():
        last_scrape = last_update_file.read_text().strip()

    return StatsResponse(
        total_papers=len(df),
        evaluated_papers=evaluated_count,
        average_score=avg_score,
        categories=categories,
        score_distribution=score_dist,
        last_scrape=last_scrape
    )


@app.get("/api/categories")
async def get_categories():
    """Get list of unique categories."""
    df = load_papers_df()

    if df.empty:
        return {"categories": []}

    categories = set()
    for cats in df['categories'].dropna():
        for cat in str(cats).split():
            categories.add(cat)

    return {"categories": sorted(list(categories))}


def run_scraper():
    """Run the scraper script."""
    global task_status
    task_status["scraper"] = "running"
    try:
        result = subprocess.run(
            [sys.executable, "main.py"],
            capture_output=True,
            text=True,
            timeout=600
        )
        if result.returncode == 0:
            task_status["scraper"] = "completed"
        else:
            task_status["scraper"] = f"failed: {result.stderr}"
    except Exception as e:
        task_status["scraper"] = f"error: {str(e)}"


def run_evaluator(num_rows: str):
    """Run the evaluator script."""
    global task_status
    task_status["evaluator"] = "running"
    try:
        result = subprocess.run(
            [sys.executable, "evaluator.py", "--rows", str(num_rows)],
            capture_output=True,
            text=True,
            timeout=3600
        )
        if result.returncode == 0:
            task_status["evaluator"] = "completed"
        else:
            task_status["evaluator"] = f"failed: {result.stderr}"
    except Exception as e:
        task_status["evaluator"] = f"error: {str(e)}"


@app.post("/api/scrape", response_model=TaskStatus)
async def trigger_scrape(background_tasks: BackgroundTasks):
    """Trigger the arXiv scraper."""
    if task_status.get("scraper") == "running":
        return TaskStatus(status="running", message="Scraper is already running")

    background_tasks.add_task(run_scraper)
    return TaskStatus(status="started", message="Scraper started in background")


@app.post("/api/evaluate", response_model=TaskStatus)
async def trigger_evaluate(
    background_tasks: BackgroundTasks,
    num_rows: int = Query(5, ge=1, le=1000)
):
    """Trigger the paper evaluator."""
    if task_status.get("evaluator") == "running":
        return TaskStatus(status="running", message="Evaluator is already running")

    background_tasks.add_task(run_evaluator, str(num_rows))
    return TaskStatus(status="started", message=f"Evaluator started for {num_rows} papers")


@app.get("/api/task-status")
async def get_task_status():
    """Get the status of background tasks."""
    return {
        "scraper": task_status.get("scraper"),
        "evaluator": task_status.get("evaluator")
    }


if __name__ == "__main__":
    import uvicorn

    # Ensure static folder exists
    Path(STATIC_FOLDER).mkdir(exist_ok=True)
    Path(RESULTS_FOLDER).mkdir(exist_ok=True)

    uvicorn.run(app, host="0.0.0.0", port=8000)
