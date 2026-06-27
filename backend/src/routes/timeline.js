import { Router } from "express";
import { getDb } from "../db.js";

const router = Router();

/**
 * GET /timeline
 * 
 * Filter behaviour: show clusters that contain AT LEAST ONE article
 * from the selected sources. A cluster with BBC+Guardian articles will
 * appear whether you filter for BBC, Guardian, or both.
 * A cluster disappears only when ALL its sources are deselected.
 *
 * Query params:
 *   ?source=bbc,reuters   — comma-separated source IDs (all shown if omitted)
 *   ?limit=50             — max clusters (default 30, max 100)
 */
router.get("/", async (req, res) => {
  try {
    const db    = await getDb();
    const limit = Math.min(parseInt(req.query.limit, 10) || 30, 100);
    const { source } = req.query;

    let clusterFilter = {
      earliest_at: { $ne: null },
      latest_at:   { $ne: null },
    };

    if (source) {
      const sources = source.split(",").map((s) => s.trim()).filter(Boolean);
      if (sources.length > 0) {
        // Find cluster IDs that have at least one article from ANY selected source
        const matchingIds = await db
          .collection("articles")
          .distinct("cluster_id", {
            source:     { $in: sources },
            cluster_id: { $ne: null },
          });
        clusterFilter._id = { $in: matchingIds };
      }
    }

    const clusters = await db
      .collection("clusters")
      .find(clusterFilter)
      .sort({ latest_at: -1 })
      .limit(limit)
      .toArray();

    const counts   = clusters.map((c) => c.article_count);
    const maxCount = Math.max(...counts, 1);

    const timeline = await Promise.all(
      clusters.map(async (c) => {
        // Always return ALL sources on the cluster (not filtered)
        // so the frontend can show correct source badges
        const allSources = await db
          .collection("articles")
          .distinct("source", { cluster_id: c._id });

        const durationMs =
          c.latest_at && c.earliest_at
            ? new Date(c.latest_at) - new Date(c.earliest_at)
            : 0;

        return {
          id:             c._id.toString(),
          label:          c.label,
          top_terms:      c.top_terms,
          article_count:  c.article_count,
          start:          c.earliest_at,
          end:            c.latest_at,
          sources:        allSources,
          intensity:      Math.max(1, Math.round((c.article_count / maxCount) * 10)),
          duration_hours: (durationMs / 3_600_000).toFixed(2),
        };
      })
    );

    const allStarts = timeline.map((t) => new Date(t.start).getTime()).filter(Boolean);
    const allEnds   = timeline.map((t) => new Date(t.end).getTime()).filter(Boolean);

    const stats = {
      totalClusters: timeline.length,
      totalArticles: counts.reduce((s, n) => s + n, 0),
      earliestDate:  allStarts.length ? new Date(Math.min(...allStarts)).toISOString() : null,
      latestDate:    allEnds.length   ? new Date(Math.max(...allEnds)).toISOString()   : null,
    };

    return res.json({ timeline, stats });
  } catch (err) {
    console.error("GET /timeline error:", err);
    return res.status(500).json({ error: "Failed to fetch timeline" });
  }
});

export default router;
