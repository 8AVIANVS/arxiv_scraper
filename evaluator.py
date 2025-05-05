#!/usr/bin/env python3

import os
import json
import pandas as pd
import re
from dotenv import load_dotenv
from openai import OpenAI
import logging
import time
from pathlib import Path

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Initialize OpenAI client
client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

# System prompt for evaluating startup viability
SYSTEM_PROMPT = """
I am sending you a list of paper abstracts. Please give a score from 1-10 on how viable the paper topic is to be turned into a startup.

1 = Not viable at all (purely theoretical with no practical applications)
10 = Extremely viable (ready for commercialization with clear market potential)

Respond with a JSON object containing:
1. "score": a number between 1 and 10
2. "reasoning": a brief explanation (max 3 sentences) of your score

Example response format:
{"score": 7, "reasoning": "The technology addresses a clear market need in cybersecurity. The approach is novel compared to existing solutions. However, implementation costs may be high for initial market entry."}
"""


def evaluate_abstract(abstract, client):
    """Evaluate a paper abstract using OpenAI's 4o model"""
    try:
        # Call OpenAI API with the abstract
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": abstract}
            ],
            temperature=0.5,  # Lower temperature for more consistent scoring
            max_tokens=150    # Limit token usage for efficiency
        )
        
        # Extract the JSON response
        result_text = response.choices[0].message.content.strip()
        
        # Handle potential non-JSON responses
        try:
            # Parse the JSON response
            result = json.loads(result_text)
            # Ensure score is a number between 1 and 10
            score = float(result.get("score", 0))
            score = max(1, min(10, score))  # Clamp between 1 and 10
            reasoning = result.get("reasoning", "No reasoning provided")
            
            return {
                "score": score,
                "reasoning": reasoning
            }
        except json.JSONDecodeError:
            # If response is not valid JSON, attempt to extract score and reasoning
            score_match = re.search(r'score["\']?\s*[:]?\s*(\d+(?:\.\d+)?)', result_text, re.IGNORECASE)
            score = float(score_match.group(1)) if score_match else 0
            score = max(1, min(10, score))  # Clamp between 1 and 10
            
            # Extract reasoning (anything after "reasoning" keyword)
            reasoning_match = re.search(r'reasoning["\']?\s*[:]?\s*["\'](.*?)["\']}?', result_text, re.IGNORECASE | re.DOTALL)
            reasoning = reasoning_match.group(1) if reasoning_match else "Unable to parse reasoning"
            
            return {
                "score": score,
                "reasoning": reasoning
            }
            
    except Exception as e:
        logger.error(f"Error evaluating abstract: {e}")
        return {"score": 0, "reasoning": f"Error: {str(e)}"}


def evaluate_papers(csv_path, output_path=None, num_rows='*'):
    """Evaluate papers from a CSV file
    
    Args:
        csv_path: Path to the CSV file containing arXiv papers
        output_path: Path to save the output CSV file (defaults to original filename with _evaluated suffix)
        num_rows: Number of rows to evaluate (default '*' for all rows)
    """
    try:
        # Load the CSV file
        df = pd.read_csv(csv_path)
        logger.info(f"Loaded {len(df)} papers from {csv_path}")
        
        # Determine how many rows to process
        if num_rows != '*':
            try:
                num_rows = int(num_rows)
                df = df.head(num_rows)
                logger.info(f"Processing first {num_rows} papers")
            except ValueError:
                logger.warning(f"Invalid num_rows value: {num_rows}. Processing all papers.")
        
        # Add columns for score and reasoning if they don't exist
        if 'score' not in df.columns:
            df['score'] = 0.0
        if 'reasoning' not in df.columns:
            df['reasoning'] = ''
        
        # Process each row
        for idx, row in df.iterrows():
            abstract = row['abstract']
            if pd.isna(abstract) or not abstract.strip():
                logger.warning(f"Skipping paper at index {idx} due to empty abstract")
                continue
                
            logger.info(f"Evaluating paper {idx+1}/{len(df)}: {row['title'][:50]}...")
            result = evaluate_abstract(abstract, client)
            
            # Update the DataFrame
            df.at[idx, 'score'] = result['score']
            df.at[idx, 'reasoning'] = result['reasoning']
            
            # Add a small delay to avoid rate limiting
            time.sleep(0.5)
        
        # Save the results
        if output_path is None:
            # Generate default output path
            input_path = Path(csv_path)
            output_path = input_path.parent / f"{input_path.stem}_evaluated{input_path.suffix}"
        
        df.to_csv(output_path, index=False)
        logger.info(f"Saved evaluated papers to {output_path}")
        
        return df
        
    except Exception as e:
        logger.error(f"Error processing CSV: {e}")
        raise


def get_latest_csv(directory="results"):
    """Get the path to the latest CSV file in the results directory"""
    try:
        # Get all CSV files in the directory
        csv_files = list(Path(directory).glob("*.csv"))
        
        if not csv_files:
            logger.error(f"No CSV files found in {directory}")
            return None
        
        # Find the most recent file
        latest_file = max(csv_files, key=lambda x: x.stat().st_mtime)
        return str(latest_file)
        
    except Exception as e:
        logger.error(f"Error finding latest CSV: {e}")
        return None


def main():
    """Main function to run the evaluator"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Evaluate arXiv papers for startup viability')
    parser.add_argument('--csv', help='Path to the CSV file containing arXiv papers')
    parser.add_argument('--rows', default='5', help='Number of rows to evaluate (* for all rows)')
    parser.add_argument('--output', help='Path to save the output CSV file')
    
    args = parser.parse_args()
    
    # If no CSV path is provided, use the latest CSV in the results directory
    if not args.csv:
        csv_path = get_latest_csv()
        if not csv_path:
            logger.error("No CSV file specified and no CSV files found in results directory")
            return
    else:
        csv_path = args.csv
    
    # Evaluate the papers
    evaluate_papers(csv_path, args.output, args.rows)


if __name__ == "__main__":
    main()
