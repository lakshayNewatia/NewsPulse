"""
News Pulse - Topic Clustering
TF-IDF + cosine similarity with union-find, plus recursive bisection
for oversized clusters.

Approach:
  1. Run standard union-find clustering at threshold 0.25
  2. Any cluster exceeding MAX_CLUSTER_SIZE (12) is re-clustered
     internally at a higher threshold (0.35) to split it into
     more coherent sub-clusters
  3. Digest articles and boilerplate are excluded before vectorisation

Why recursive bisection?
  Al Jazeera covers sport, geopolitics and economics with similar
  formal vocabulary. A "World Cup" article and a "Strait of Hormuz"
  article share enough generic terms to exceed 0.25 similarity.
  At 0.35 they correctly separate because the domain-specific terms
  (FIFA, knockout, goal vs tanker, Oman, crude) diverge sharply.
  Applying 0.35 globally would split genuine same-story clusters
  that only share 3-4 key terms — so we only apply it surgically
  to clusters that are clearly too large.

Threshold: 0.25 (global), 0.35 (bisection of oversized clusters)
Max cluster size before bisection: 12 articles
"""

import logging
import os
import re
from datetime import datetime, timezone
from collections import defaultdict

import numpy as np
from pymongo import MongoClient
from dotenv import load_dotenv
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

load_dotenv()
log = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

SIMILARITY_THRESHOLD      = 0.25
BISECTION_THRESHOLD       = 0.35   # stricter threshold for splitting large clusters
MAX_CLUSTER_SIZE          = 12     # clusters larger than this get bisected
MIN_CLUSTER_SIZE          = 2
TOP_N_TERMS               = 5
MAX_ARTICLES              = 2000

DIGEST_PATTERNS = [
    "briefing", "roundup", "round-up", "first thing", "newsletter",
    "morning", "evening", "daily", "weekly", "in brief", "at a glance",
    "what we know", "wrap", "digest", "live blog", "as it happened",
    "latest updates", "live updates", "live:",
]

BOILERPLATE_PHRASES = [
    r"follow our[\w\s]+ live blog[^.]*",
    r"follow our australia news[^.]*",
    r"get our breaking news email[^.]*",
    r"free app or daily news podcast",
    r"sign up for the[\w\s]+email[^.]*",
    r"continue reading\.\.\.",
    r"read more[:\s]",
    r"image credit[:\s][^\n]*",
    r"ap photo[^\n]*",
    r"\(image credit[^\)]*\)",
    r"archive[:\s]+ap[,\s]+reuters",
]

EXTRA_STOP_WORDS = {
    "says", "said", "say", "new", "will", "also", "one", "two", "three",
    "year", "years", "day", "days", "week", "month", "time", "people",
    "reuters", "guardian", "bbc", "aljazeera", "al", "jazeera", "npr",
    "according", "reported", "reports", "official", "officials",
    "government", "first", "last", "after", "could", "would", "told",
    "including", "latest", "make", "made", "read", "continue", "news",
    "watch", "live", "update", "updates", "today", "thursday", "friday",
    "saturday", "sunday", "monday", "tuesday", "wednesday",
    "briefing", "morning", "good", "thing", "things", "follow",
    "get", "sign", "email", "free", "app", "podcast", "world", "woman", 
    "man", "men", "women", "police", "court", "minister", "prime", "inside", "start",
    "love", "shows", "girl", "boy"
}


def get_db():
    client = MongoClient(os.environ["MONGODB_URI"])
    return client[os.environ.get("MONGODB_DB", "newspulse")]


def _is_digest(article: dict) -> bool:
    title = (article.get("title") or "").lower()
    return any(p in title for p in DIGEST_PATTERNS)


def _strip_boilerplate(text: str) -> str:
    for pattern in BOILERPLATE_PHRASES:
        text = re.sub(pattern, " ", text, flags=re.IGNORECASE)
    return text


def _build_doc(row: dict) -> str:
    title   = (row.get("title") or "").strip()
    summary = _strip_boilerplate((row.get("summary") or "").strip())
    body    = _strip_boilerplate((row.get("body") or "")[:800].strip())
    return f"{title} {title} {title} {title} {summary} {body}"


def _clean(text: str) -> str:
    text = re.sub(r"http\S+", " ", text)
    text = re.sub(r"[^a-zA-Z\s]", " ", text)
    return re.sub(r"\s+", " ", text).strip().lower()


def _union_find(sim_matrix: np.ndarray, threshold: float) -> list[list[int]]:
    """Union-find on a similarity matrix. Returns clusters as index lists."""
    n = len(sim_matrix)
    parent = list(range(n))

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(x, y):
        px, py = find(x), find(y)
        if px != py:
            parent[px] = py

    for i in range(n):
        for j in range(i + 1, n):
            if sim_matrix[i, j] >= threshold:
                union(i, j)

    groups: dict[int, list[int]] = defaultdict(list)
    for i in range(n):
        groups[find(i)].append(i)
    return list(groups.values())


def _bisect_large_cluster(
    indices: list[int],
    articles: list[dict],
    vectorizer,
) -> list[list[int]]:
    """
    Re-cluster a large cluster at a stricter threshold.
    Maps local indices back to original article indices.
    Returns list of sub-clusters (original indices).
    """
    if len(indices) <= MIN_CLUSTER_SIZE:
        return [indices]

    docs = [_clean(_build_doc(articles[i])) for i in indices]
    try:
        sub_matrix = vectorizer.transform(docs)
    except Exception:
        return [indices]

    sim        = cosine_similarity(sub_matrix)
    sub_groups = _union_find(sim, BISECTION_THRESHOLD)

    # Map local indices back to original article indices
    return [[indices[local_i] for local_i in grp] for grp in sub_groups]


def _cluster_label(indices: list[int], articles: list[dict], vectorizer) -> tuple[str, list[str]]:
    feature_names = vectorizer.get_feature_names_out()
    docs = [_clean(_build_doc(articles[i])) for i in indices]
    try:
        sub_matrix = vectorizer.transform(docs)
    except Exception:
        return "General News", []

    mean_tfidf = np.asarray(sub_matrix.mean(axis=0)).flatten()
    top_idx    = mean_tfidf.argsort()[::-1]

    terms      = []
    seen_words = set()
    for idx in top_idx:
        term  = feature_names[idx]
        words = set(term.split())
        if words & seen_words:
            continue
        if term not in EXTRA_STOP_WORDS and len(term) > 2:
            terms.append(term)
            seen_words.update(words)
        if len(terms) == TOP_N_TERMS:
            break

    if not terms:
        return "General News", []

    return " · ".join(t.title() for t in terms[:3]), terms


def run_clustering() -> dict:
    db = get_db()

    all_articles = list(
        db.articles.find(
            {},
            {"_id": 1, "source": 1, "title": 1, "summary": 1,
             "body": 1, "url": 1, "published_at": 1}
        )
        .sort("published_at", -1)
        .limit(MAX_ARTICLES)
    )

    if not all_articles:
        log.warning("No articles found — run ingestion first.")
        return {"clusters": 0, "articles": 0}

    articles = [a for a in all_articles if not _is_digest(a)]
    digests  = [a for a in all_articles if _is_digest(a)]
    log.info(f"Clustering {len(articles)} articles ({len(digests)} digests excluded) …")

    docs = [_clean(_build_doc(a)) for a in articles]

    vectorizer = TfidfVectorizer(
        stop_words="english",
        max_df=0.80,
        min_df=2,
        ngram_range=(1, 2),
        max_features=8000,
        sublinear_tf=True,
    )
    try:
        tfidf_matrix = vectorizer.fit_transform(docs)
    except ValueError:
        log.warning("Vocabulary too small; skipping clustering.")
        return {"clusters": 0, "articles": len(articles)}

    sim            = cosine_similarity(tfidf_matrix)
    initial_groups = _union_find(sim, SIMILARITY_THRESHOLD)
    log.info(f"Initial: {len(initial_groups)} clusters.")

    # Bisect any cluster that is too large
    final_groups = []
    bisected     = 0
    for group in initial_groups:
        if len(group) > MAX_CLUSTER_SIZE:
            sub_groups = _bisect_large_cluster(group, articles, vectorizer)
            final_groups.extend(sub_groups)
            bisected += 1
            log.info(f"  Bisected cluster of {len(group)} → {len(sub_groups)} sub-clusters")
        else:
            final_groups.append(group)

    if bisected:
        log.info(f"After bisection: {len(final_groups)} clusters.")

    db.clusters.delete_many({})
    db.articles.update_many({}, {"$set": {"cluster_id": None}})

    saved_clusters = 0
    for group_indices in final_groups:
        if len(group_indices) < MIN_CLUSTER_SIZE:
            continue

        label, top_terms = _cluster_label(group_indices, articles, vectorizer)

        timestamps = [
            articles[i]["published_at"]
            for i in group_indices
            if articles[i].get("published_at")
        ]
        earliest = min(timestamps) if timestamps else None
        latest   = max(timestamps) if timestamps else None

        result = db.clusters.insert_one({
            "label":         label,
            "top_terms":     top_terms,
            "article_count": len(group_indices),
            "earliest_at":   earliest,
            "latest_at":     latest,
            "created_at":    datetime.now(timezone.utc),
        })
        cluster_id = result.inserted_id

        article_db_ids = [articles[i]["_id"] for i in group_indices]
        db.articles.update_many(
            {"_id": {"$in": article_db_ids}},
            {"$set": {"cluster_id": cluster_id}},
        )
        saved_clusters += 1

    log.info(f"Saved {saved_clusters} clusters (min size {MIN_CLUSTER_SIZE}).")
    return {"clusters": saved_clusters, "articles": len(articles)}


if __name__ == "__main__":
    result = run_clustering()
    print(result)
