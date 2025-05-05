#!/usr/bin/env python3

import os
import sys
import pandas as pd
import arxivscraper
from datetime import datetime, timedelta
from dateutil import parser
import logging
import json

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Define constants
LAST_UPDATE_FILE = 'last_update.txt'
RESULTS_FOLDER = 'results'
CATEGORIES = ['cs', 'eess', 'stat']
MAX_DAYS = 7


def ensure_directories_exist():
    """Ensure that the results directory exists."""
    if not os.path.exists(RESULTS_FOLDER):
        os.makedirs(RESULTS_FOLDER)
        logger.info(f"Created directory: {RESULTS_FOLDER}")


def get_date_range():
    """Determine the date range to scrape based on the last update."""
    today = datetime.now().date()
    
    # Check if the last update file exists
    if os.path.exists(LAST_UPDATE_FILE):
        try:
            with open(LAST_UPDATE_FILE, 'r') as f:
                last_update_str = f.read().strip()
                last_update = parser.parse(last_update_str).date()
                logger.info(f"Last update date: {last_update}")
        except Exception as e:
            logger.error(f"Error reading last update file: {e}")
            last_update = today - timedelta(days=MAX_DAYS)
    else:
        logger.info("No last update file found, using default range.")
        last_update = today - timedelta(days=MAX_DAYS)
    
    # Ensure we don't scrape more than MAX_DAYS
    from_date = max(last_update, today - timedelta(days=MAX_DAYS))
    
    logger.info(f"Scraping from {from_date} to {today}")
    return from_date.strftime("%Y-%m-%d"), today.strftime("%Y-%m-%d")


def scrape_arxiv(category, date_from, date_until):
    """Scrape arXiv papers for a given category and date range."""
    logger.info(f"Scraping {category} from {date_from} to {date_until}")
    
    try:
        scraper = arxivscraper.Scraper(category=category, date_from=date_from, date_until=date_until)
        papers = scraper.scrape()
        logger.info(f"Retrieved {len(papers)} papers for {category}")
        return papers
    except Exception as e:
        logger.error(f"Error scraping {category}: {e}")
        return []


def save_results(all_papers):
    """Save the scraped papers to CSV and JSON files."""
    if not all_papers:
        logger.warning("No papers to save")
        return
    
    # Create a DataFrame
    cols = ('id', 'title', 'categories', 'abstract', 'doi', 'created', 'updated', 'authors')
    df = pd.DataFrame(all_papers, columns=cols)
    
    # Use fixed filenames without timestamps
    csv_file = os.path.join(RESULTS_FOLDER, "arxiv_papers.csv")
    json_file = os.path.join(RESULTS_FOLDER, "arxiv_papers.json")
    
    # Save to CSV
    df.to_csv(csv_file, index=False)
    logger.info(f"Saved {len(df)} papers to {csv_file}")
    
    # Save to JSON
    df.to_json(json_file, orient='records', lines=True)
    logger.info(f"Saved {len(df)} papers to {json_file}")


def update_last_update(date):
    """Update the last update file with the given date."""
    with open(LAST_UPDATE_FILE, 'w') as f:
        f.write(date)
    logger.info(f"Updated last update date to {date}")


def main():
    """Main function to run the arXiv scraper."""
    logger.info("Starting arXiv scraper")
    
    # Ensure directories exist
    ensure_directories_exist()
    
    # Get date range
    date_from, date_until = get_date_range()
    
    # Scrape papers for each category
    all_papers = []
    for category in CATEGORIES:
        papers = scrape_arxiv(category, date_from, date_until)
        all_papers.extend(papers)
    
    # Save results
    save_results(all_papers)
    
    # Update last update date
    update_last_update(date_until)
    
    logger.info(f"Completed scraping with {len(all_papers)} papers retrieved")


if __name__ == "__main__":
    main()
