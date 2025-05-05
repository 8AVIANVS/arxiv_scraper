# arXiv Scraper Tool

This tool scrapes arXiv papers from the Computer Science (cs), Electrical Engineering and Systems Science (eess), and Statistics (stat) categories. It tracks the last update date and only retrieves papers published since then (up to a maximum of 7 days back).

## Features

- Automatically tracks the last scrape date in `last_update.txt`
- Limits scraping to a maximum of 7 days to avoid excessive data retrieval
- Saves results in both CSV and JSON formats with timestamps
- Scrapes papers from cs, eess, and stat categories
- Creates a results directory if it doesn't exist

## Installation

1. Install the required dependencies:

```bash
pip install -r requirements.txt
```

## Usage

Simply run the main script:

```bash
python main.py
```

The script will:
1. Check if `last_update.txt` exists to determine the date range to scrape
2. Retrieve papers from the specified categories within that date range
3. Save the results to the `results` folder in both CSV and JSON formats
4. Update the `last_update.txt` file with the current date

## Output Files

The scraped papers will be saved in the `results` folder with timestamp-based filenames:
- `arxiv_papers_YYYYMMDD_HHMMSS.csv`
- `arxiv_papers_YYYYMMDD_HHMMSS.json`

## Configuration

You can modify the following constants in the script:
- `CATEGORIES`: List of arXiv categories to scrape
- `MAX_DAYS`: Maximum number of days to look back
- `RESULTS_FOLDER`: Folder where results are saved
- `LAST_UPDATE_FILE`: File that tracks the last update date

## License

MIT
