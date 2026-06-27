"""
News Pulse Pipeline Entry Point
Runs ingestion then clustering in sequence.
Called by the Node.js backend via subprocess.
"""

import sys
import json
import logging
from scraper import run_ingestion
from clusterer import run_clustering

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

def main():
    print("=== News Pulse Pipeline Start ===", flush=True)
    
    print("[1/2] Running RSS ingestion...", flush=True)
    ingested = run_ingestion()
    print(f"[1/2] Ingested {ingested} articles.", flush=True)
    
    print("[2/2] Running topic clustering...", flush=True)
    result = run_clustering()
    print(f"[2/2] Clustering complete: {result}", flush=True)
    
    print("=== Pipeline Complete ===", flush=True)
    output = {"status": "complete", "ingested": ingested, **result}
    print(f"RESULT:{json.dumps(output)}", flush=True)
    return 0

if __name__ == "__main__":
    sys.exit(main())
