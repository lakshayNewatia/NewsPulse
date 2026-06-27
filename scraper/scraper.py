"""
News Pulse - RSS Ingestion & Article Extraction
Pulls from BBC, NPR, Al Jazeera, The Guardian
Normalizes inconsistent feed formats into a unified schema
"""

import feedparser
import trafilatura
import hashlib
import logging
import re
import time
from datetime import datetime, timezone
from dateutil import parser as dateutil_parser
from urllib.request import urlopen, Request
from urllib.error import URLError, HTTPError
from pymongo import MongoClient, UpdateOne
from pymongo.errors import BulkWriteError
import os
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
log = logging.getLogger(__name__)

# ── Feed definitions ──────────────────────────────────────────────────────────
FEEDS = [
    {
        "name": "BBC News",
        "url": "http://feeds.bbci.co.uk/news/rss.xml",
        "source_id": "bbc",
    },
    {
        "name": "NPR",
        "url": "https://feeds.npr.org/1001/rss.xml",
        "source_id": "npr",
    },
    {
        "name": "Al Jazeera",
        "url": "https://www.aljazeera.com/xml/rss/all.xml",
        "source_id": "aljazeera",
    },
    {
        "name": "The Guardian",
        "url": "https://www.theguardian.com/world/rss",
        "source_id": "guardian",
    },
]

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (compatible; NewsPulse/1.0; +https://newspulse.example.com)"
    )
}

# ── DB helpers ────────────────────────────────────────────────────────────────

def get_db():
    client = MongoClient(os.environ["MONGODB_URI"])
    return client[os.environ.get("MONGODB_DB", "newspulse")]


# ── Normalisation helpers ─────────────────────────────────────────────────────

def _url_id(url: str) -> str:
    return hashlib.sha256(url.encode()).hexdigest()[:24]


def _parse_date(entry) -> datetime | None:
    """Try multiple date fields; fall back to now."""
    for field in ("published", "updated", "created"):
        raw = entry.get(field)
        if raw:
            try:
                return dateutil_parser.parse(raw).astimezone(timezone.utc)
            except Exception:
                pass
    for field in ("published_parsed", "updated_parsed"):
        tup = entry.get(field)
        if tup:
            try:
                return datetime(*tup[:6], tzinfo=timezone.utc)
            except Exception:
                pass
    return datetime.now(timezone.utc)


def _get_text(entry) -> str:
    """Extract best summary text from feed entry."""
    for field in ("content", "summary_detail", "description"):
        val = entry.get(field)
        if not val:
            continue
        if isinstance(val, list) and val:
            val = val[0]
        if isinstance(val, dict):
            val = val.get("value", "")
        if val and isinstance(val, str):
            clean = re.sub(r"<[^>]+>", " ", val)
            clean = re.sub(r"\s+", " ", clean).strip()
            if len(clean) > 30:
                return clean
    return entry.get("summary", "") or ""


def _fetch_body(url: str, timeout: int = 10) -> str | None:
    """Fetch full article body using trafilatura. Fails gracefully."""
    try:
        req = Request(url, headers=HEADERS)
        with urlopen(req, timeout=timeout) as resp:
            html = resp.read()
        text = trafilatura.extract(
            html,
            include_comments=False,
            include_tables=False,
            no_fallback=False,
        )
        if text and len(text) > 100:
            return text.strip()
    except (URLError, HTTPError) as e:
        log.debug(f"HTTP error fetching {url}: {e}")
    except Exception as e:
        log.debug(f"Body extraction failed for {url}: {e}")
    return None


# ── Core ingestion ────────────────────────────────────────────────────────────

def ingest_feed(feed_cfg: dict, db) -> int:
    """Parse one RSS feed and upsert new articles. Returns count processed."""
    log.info(f"Fetching feed: {feed_cfg['name']}")
    try:
        parsed = feedparser.parse(
            feed_cfg["url"],
            agent=HEADERS["User-Agent"],
            request_headers={"Accept": "application/rss+xml, application/xml, */*"},
        )
    except Exception as e:
        log.warning(f"Failed to parse {feed_cfg['name']}: {e}")
        return 0

    if parsed.bozo and not parsed.entries:
        log.warning(f"Bozo error on {feed_cfg['name']}: {parsed.bozo_exception}")
        return 0

    ops = []
    for entry in parsed.entries:
        url = entry.get("link") or entry.get("id")
        if not url:
            continue

        title = entry.get("title", "").strip()
        if not title:
            continue

        article_id = _url_id(url)
        summary = _get_text(entry)
        pub_at = _parse_date(entry)

        body = _fetch_body(url)
        time.sleep(0.3)  # polite crawl delay

        ops.append(
            UpdateOne(
                {"article_id": article_id},
                {"$setOnInsert": {
                    "article_id": article_id,
                    "source":     feed_cfg["source_id"],
                    "title":      title,
                    "summary":    summary,
                    "body":       body,
                    "url":        url,
                    "published_at": pub_at,
                    "cluster_id": None,
                    "fetched_at": datetime.now(timezone.utc),
                }},
                upsert=True,
            )
        )

    if not ops:
        return 0

    try:
        db.articles.bulk_write(ops, ordered=False)
    except BulkWriteError:
        pass  # duplicate key errors are expected and safe to ignore

    log.info(f"  → {len(ops)} entries processed from {feed_cfg['name']}")
    return len(ops)


def run_ingestion() -> int:
    db = get_db()
    # Ensure unique index on article_id (idempotent — safe to call repeatedly)
    db.articles.create_index("article_id", unique=True)

    total = 0
    for feed in FEEDS:
        try:
            total += ingest_feed(feed, db)
        except Exception as e:
            log.error(f"Unexpected error on {feed['name']}: {e}")

    log.info(f"Ingestion complete — {total} entries processed.")
    return total


if __name__ == "__main__":
    run_ingestion()
