import csv
import os
import argparse
from pathlib import Path


def segment_csv(csv_path, num_chunks):
    """
    Segment a CSV file into a specified number of chunks.

    Args:
        csv_path (str): Path to the CSV file
        num_chunks (int): Number of chunks to create
    """
    # Convert to Path object for easier manipulation
    path = Path(csv_path)

    # Get directory and filename without extension
    directory = path.parent
    base_filename = path.stem

    # First, count total rows in CSV
    total_rows = 0
    with open(csv_path, 'r', newline='') as csvfile:
        reader = csv.reader(csvfile)
        headers = next(reader)  # Skip header row
        for _ in reader:
            total_rows += 1

    print(f"Total rows in CSV: {total_rows}")

    if total_rows == 0:
        print("Warning: CSV file has no data rows.")
        return

    # Calculate rows per chunk
    base_chunk_size = total_rows // num_chunks
    remainder = total_rows % num_chunks

    # Read data and split into chunks
    with open(csv_path, 'r', newline='') as csvfile:
        reader = csv.reader(csvfile)
        headers = next(reader)  # Get headers

        rows = list(reader)  # Read all rows into memory

        start_idx = 0
        for chunk_num in range(1, num_chunks + 1):
            # Calculate size for this chunk
            chunk_size = base_chunk_size
            # Add an extra row to earlier chunks if there's a remainder
            if chunk_num <= remainder:
                chunk_size += 1

            end_idx = start_idx + chunk_size
            # Get chunk data
            chunk_data = rows[start_idx:end_idx]

            # Write chunk to file
            output_filename = f"{base_filename}_chunk{chunk_num}.csv"
            output_path = directory / output_filename
            write_chunk(output_path, headers, chunk_data)

            # Update start index for next chunk
            start_idx = end_idx


def write_chunk(output_path, headers, chunk):
    """
    Write a chunk of data to a CSV file.

    Args:
        output_path (Path): Path to output file
        headers (list): CSV headers
        chunk (list): List of data rows
    """
    with open(output_path, 'w', newline='') as csvfile:
        writer = csv.writer(csvfile)
        writer.writerow(headers)
        writer.writerows(chunk)
    print(f"Created: {output_path} with {len(chunk)} rows")


def main():
    parser = argparse.ArgumentParser(description="Segment a CSV file into a specified number of chunks")
    parser.add_argument("csv_path", help="Path to the CSV file")
    parser.add_argument("num_chunks", type=int, help="Number of chunks to create")

    args = parser.parse_args()

    # Validate inputs
    if not os.path.exists(args.csv_path):
        print(f"Error: File not found - {args.csv_path}")
        return

    if args.num_chunks <= 0:
        print("Error: Number of chunks must be a positive integer")
        return

    # Segment the CSV file
    segment_csv(args.csv_path, args.num_chunks)
    print("Segmentation complete!")


if __name__ == "__main__":
    main()
