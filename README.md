# arXiv Scraper and Evaluator Tool

This tool scrapes arXiv papers from the Computer Science (cs), Electrical Engineering and Systems Science (eess), and Statistics (stat) categories and includes functionality to evaluate papers for startup potential using OpenAI's GPT-4o model.

## Features

### Scraper (main.py)
- Automatically tracks the last scrape date in `last_update.txt`
- Limits scraping to a maximum of 7 days to avoid excessive data retrieval
- Saves results in both CSV and JSON formats
- Scrapes papers from cs, eess, and stat categories
- Creates a results directory if it doesn't exist

### Evaluator (evaluator.py)
- Analyzes paper abstracts for startup viability using OpenAI's GPT-4o
- Scores each paper on a scale of 1-10 for startup potential
- Provides reasoning for each score
- Can process all papers or a specified number of papers
- Saves results with original data plus evaluation columns

## Installation

1. Install the required dependencies:

```bash
pip install -r requirements.txt
```

## Usage

### Scraping Papers

Run the main script to scrape papers:

```bash
python main.py
```

The script will:
1. Check if `last_update.txt` exists to determine the date range to scrape
2. Retrieve papers from the specified categories within that date range
3. Save the results to the `results` folder in both CSV and JSON formats
4. Update the `last_update.txt` file with the current date

### Evaluating Papers for Startup Potential

After scraping papers, use the evaluator script to analyze them:

```bash
python evaluator.py --rows 5  # Evaluate first 5 papers
```

Parameters:
- `--csv`: Path to CSV file (optional, uses latest file in results directory if not specified)
- `--rows`: Number of rows to evaluate (use '*' for all papers)
- `--output`: Custom output path (optional)

Examples:
```bash
python evaluator.py  # Default: evaluates first 5 papers from latest CSV
python evaluator.py --rows 10  # Evaluate first 10 papers
python evaluator.py --rows '*'  # Evaluate all papers (may take time)
python evaluator.py --csv custom_path.csv  # Use specific CSV file
```

The evaluator requires an OpenAI API key in a `.env` file:
```
OPENAI_API_KEY=your_api_key_here
```

## Output Files

### Scraper Output
The scraped papers will be saved in the `results` folder with fixed filenames:
- `arxiv_papers.csv`
- `arxiv_papers.json`

### Evaluator Output
The evaluated papers will be saved with the suffix `_evaluated` added to the original filename:
- `arxiv_papers_evaluated.csv`

## Configuration

You can modify the following constants in the script:
- `CATEGORIES`: List of arXiv categories to scrape
- `MAX_DAYS`: Maximum number of days to look back
- `RESULTS_FOLDER`: Folder where results are saved
- `LAST_UPDATE_FILE`: File that tracks the last update date
