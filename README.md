# News Pulse — Topic-Clustered News Timeline

A full-stack system that pulls live articles from four major news RSS feeds, automatically groups related articles into topic clusters using TF-IDF + cosine similarity, and visualises them as an interactive timeline.

- **Frontend:** [https://news-pulse-woad.vercel.app/](https://news-pulse-woad.vercel.app/)
- **Backend API:** [https://newspulse-jmpd.onrender.com](https://newspulse-jmpd.onrender.com)

---

## Architecture Overview

```
┌─────────────────────┐        REST API         ┌──────────────────────┐
│   Next.js 14        │ ◄────────────────────── │  Node.js / Express   │
│   Frontend          │ ──── POST /ingest ────► │  Backend (port 4000) │
│   (Vercel)          │                         │  (Render)            │
└─────────────────────┘                         └──────────┬───────────┘
                                                           │ spawns subprocess
                                                           ▼
                                                ┌──────────────────────┐
                                                │   Python Pipeline    │
                                                │   scraper.py         │
                                                │   clusterer.py       │
                                                └──────────┬───────────┘
                                                           │ reads / writes
                                                           ▼
                                                ┌──────────────────────┐
                                                │   MongoDB Atlas      │
                                                │   collections:       │
                                                │   articles, clusters │
                                                └──────────────────────┘
```

**What runs where:**
- **Frontend** → Vercel. Zero-config deployment from `/frontend` subdirectory.
- **Backend API** → Render (Node.js web service). Handles API requests and spawns the Python pipeline on demand.
- **Python pipeline** → Runs as a subprocess triggered by `POST /ingest/trigger` from the Node backend. No separate hosting needed — Render installs Python alongside Node.
- **Database** → MongoDB Atlas free tier. Accessible from both the Node backend and Python pipeline via `MONGODB_URI`.

---

## News Sources

| Source | Feed URL | Source ID | Why chosen |
|--------|----------|-----------|------------|
| BBC News | `http://feeds.bbci.co.uk/news/rss.xml` | `bbc` | Broad international coverage, explicitly cited in brief |
| NPR | `https://feeds.npr.org/1001/rss.xml` | `npr` | US perspective, explicitly cited in brief, strong vocabulary overlap with BBC/Guardian |
| Al Jazeera | `https://www.aljazeera.com/xml/rss/all.xml` | `aljazeera` | Middle Eastern editorial angle, good cross-source story merging |
| The Guardian | `https://www.theguardian.com/world/rss` | `guardian` | UK/European perspective, rich article body text |

Four sources were chosen (vs. the minimum three) to demonstrate richer cross-source clustering — a story like Venezuela earthquakes gets 10 articles across all four outlets, which makes the timeline more informative and cross-source merging more visually compelling.

---

## Topic Grouping: TF-IDF + Cosine Similarity

### Approach chosen: Option B (TF-IDF)

**Why TF-IDF over keyword overlap:**
Keyword overlap counts shared words equally regardless of their importance. A word like "government" appearing in 40 of 80 articles would score as a strong match between unrelated stories. TF-IDF weights terms by how distinctive they are to a specific subset of articles — "venezuela" scoring high when it appears in 10 articles but "said" scoring near-zero despite appearing in all 80. Cosine similarity then measures the angle between topic vectors, handling articles of very different lengths fairly.

### Implementation

```
scraper.py     → fetches RSS feeds, extracts full article body, upserts to MongoDB
clusterer.py   → reads articles, vectorises with TF-IDF, clusters via union-find,bisects oversized clusters, writes cluster documents to MongoDB
pipeline.py    → entry point that runs both in sequence
```

**Step 1 — Text preparation:**
- Title repeated 4× before vectorisation (headline is the strongest topic signal)
- Publisher boilerplate stripped: "Follow our Australia news live blog", "Image credit:", NPR photo captions, etc. These phrases repeat verbatim across unrelated articles on the same outlet and create false TF-IDF similarity
- Digest articles excluded entirely: articles whose titles contain "briefing", "roundup", "morning", "first thing", "live blog", etc. cover multiple unrelated topics and act as false bridges between distinct story clusters

**Step 2 — Vectorisation:**
```python
TfidfVectorizer(
    stop_words="english",
    max_df=0.80,        # ignore terms in >80% of docs (too common)
    min_df=2,           # ignore terms in <2 docs (noise)
    ngram_range=(1, 2), # unigrams + bigrams: "climate change" > "climate"
    max_features=8000,
    sublinear_tf=True,  # log(1+tf) smoothing
)
```

**Step 3 — Union-find clustering at threshold 0.25:**
Any two articles with cosine similarity ≥ 0.25 are merged into the same cluster.

**Step 4 — Recursive bisection for oversized clusters:**
Any cluster exceeding 12 articles is re-clustered internally at a stricter threshold of 0.35. This handles the case where Al Jazeera's broad coverage vocabulary bridges unrelated topics (e.g. World Cup results and Strait of Hormuz shipping initially merged because Al Jazeera covers both with similar formal vocabulary). At 0.35 the domain-specific terms diverge sharply and the clusters split correctly.

### Parameter choices

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Similarity threshold | 0.25 | Tuned on 80–200 article corpus. 0.20 over-merges via digest bridge articles; 0.30 splits genuine same-story clusters |
| Bisection threshold | 0.35 | Applied only to clusters >12 articles. Separates broad-topic merges without affecting tight clusters |
| Max cluster size | 12 | Empirically: legitimate news clusters rarely exceed 12 articles in a 3-day window across 4 sources |
| Title weight | 4× repetition | Tested 2×, 3×, 4×: 4× produces the most coherent labels without over-suppressing body text |
| max_df | 0.80 | Removes ubiquitous terms like "said", "told", "according" that appear in >80% of news articles |
| ngram_range | (1,2) | Bigrams like "supreme court", "world cup", "strait hormuz" are far more discriminating than their unigrams alone |

### Known limitations

**1. Occasional false-positive merges (single-linkage chaining):** Union-find uses single-linkage: if article A ~ B and B ~ C (both above threshold) but A ≁ C, all three merge into one cluster. This can pull slightly related sub-stories into the same cluster. The fix would be switching to complete-linkage agglomerative clustering (`sklearn.cluster.AgglomerativeClustering` with `linkage='complete'`), which I would add with more time.

**2. Low-volume TF-IDF false positives:** At small corpus sizes (~70 articles), unrelated articles can share enough moderately weighted terms to exceed the `0.25` similarity threshold. This was observed in live data, where a South Korean first-lady bribery story merged with European heatwave coverage because both articles happened to share terms such as *court*, *health*, and *European* at similar TF-IDF weights. A secondary title-keyword gate — rejecting a merge unless two articles also share at least one high-weight unigram in their titles would likely eliminate most of these false positives.

**3. Same story occasionally fragments across clusters:** When a high-volume story (for example, the Venezuela earthquakes with 10+ articles) triggers recursive bisection, the stricter `0.35` threshold can over-split it into multiple sub-clusters that are genuinely the same event. This reflects the trade-off introduced by bisection: reducing unrelated merges at the cost of fragmenting related stories. A more robust approach would apply bisection only when candidate sub-clusters exhibit clearly divergent top terms rather than purely based on cluster size.

---

## Setup Instructions

### Prerequisites
- Python 3.11+
- Node.js 20+
- MongoDB Atlas account (free tier) or local MongoDB

### 1. Clone the repository

```bash
git clone https://github.com/yourusername/newspulse
cd newspulse
```

### 2. MongoDB

Create a free cluster on [MongoDB Atlas](https://www.mongodb.com/atlas). Copy the connection string. The schema (collections and indexes) is created automatically on first pipeline run — nothing to set up manually.

### 3. Python scraper

```bash
cd scraper

pip install -r requirements.txt

# Run full pipeline (scrape + cluster):
python pipeline.py

# Or run steps individually:
python scraper.py     # fetch articles only
python clusterer.py   # recluster existing articles only
```

### 4. Node.js backend

```bash
cd backend

npm install
npm run dev     
npm start       
```

### 5. Next.js frontend

```bash
cd frontend

npm install
npm run dev     
npm run build  
```

Open [http://localhost:3000](http://localhost:3000).

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/clusters` | All clusters: label, article count, time range, sources |
| `GET` | `/clusters/:id` | Cluster detail with all articles sorted chronologically |
| `GET` | `/timeline` | Clusters formatted for charting: start/end timestamps, intensity score |
| `POST` | `/ingest/trigger` | Spawns Python pipeline; returns `{ jobId }` immediately |
| `GET` | `/ingest/status/:jobId` | Poll pipeline status: `running` / `complete` / `failed` |
| `GET` | `/health` | Health check |

**Query parameters:**
- `GET /timeline?source=bbc,npr` — filter by comma-separated source IDs
- `GET /timeline?limit=50` — max clusters returned (default 30)
- `GET /clusters?source=guardian` — filter cluster list by source

**Filter behaviour:** A cluster is shown if it contains at least one article from any selected source. A cluster with BBC + Guardian articles appears whether you filter for BBC, Guardian, or both. Only clusters exclusively from deselected sources are hidden.

---

## Stretch Goals Implemented

- ✅ **Auto-refresh** — frontend polls `/timeline` every 5 minutes silently in the background (`setInterval` in `page.tsx`)
- ✅ **Visual cluster sizing** — bar height on the timeline encodes article volume via an intensity score (1–10, normalised against the largest cluster). A 10-article cluster is visually taller and bolder than a 2-article cluster.
- ❌ **Cross-source story merging** — intentionally not implemented. The current system naturally groups same-story articles from different outlets into one cluster (e.g. Venezuela earthquakes: 10 articles from BBC, NPR, Al Jazeera, Guardian in a single cluster), which achieves the practical goal even without explicit deduplication logic.

---

## Project Structure

```
newspulse/
├── scraper/
│   ├── scraper.py       
│   ├── clusterer.py     
│   ├── pipeline.py      
│   ├── requirements.txt
├── backend/
│   └── src/
│       ├── index.js         
│       ├── db.js            
│       ├── jobStore.js      
│       └── routes/
│           ├── clusters.js  
│           ├── timeline.js  
│           └── ingest.js    
├── frontend/
│   └── src/
│       ├── app/
│       │   ├── page.tsx     
│       │   └── layout.tsx
│       ├── components/
│       │   ├── Timeline.tsx      
│       │   ├── ClusterPanel.tsx  
│       │   ├── ClusterList.tsx   
│       │   ├── SourceFilter.tsx  
│       │   ├── RefreshButton.tsx 
│       │   └── SourceBadge.tsx   
│       └── lib/api.ts               
└── README.md
```

---

## Assumptions Made

1. **Minimum cluster size = 2** — singleton clusters (single articles with no related coverage) are stored in the database but excluded from the timeline. A single article doesn't constitute a "topic cluster"
2. **Digest articles excluded from clustering** — articles whose titles indicate they are news summaries (briefings, roundups, morning newsletters) cover multiple unrelated topics. Including them causes false bridges between unrelated clusters. They remain in the database but are not assigned to any cluster.

---
