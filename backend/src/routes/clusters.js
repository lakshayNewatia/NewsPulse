import { Router } from "express";
import { ObjectId } from "mongodb";
import { getDb } from "../db.js";

const router = Router();

// Normalize MongoDB _id to id string for frontend consumption
const normalize = (doc) => {
  const { _id, ...rest } = doc;
  return { ...rest, id: _id.toString() };
};

/**
 * GET /clusters
 * Returns all clusters with label, article count, time range, and sources.
 * Supports optional ?source= filter (comma-separated source IDs).
 */
router.get("/", async (req, res) => {
  try {
    const db = await getDb();
    const { source } = req.query;

    let clusterFilter = {};

    if (source) {
      const sources = source.split(",").map((s) => s.trim()).filter(Boolean);
      // Find cluster IDs that contain at least one article from the requested sources
      const matchingArticles = await db
        .collection("articles")
        .distinct("cluster_id", { source: { $in: sources }, cluster_id: { $ne: null } });
      clusterFilter = { _id: { $in: matchingArticles } };
    }

    const clusters = await db
      .collection("clusters")
      .find(clusterFilter)
      .sort({ latest_at: -1 })
      .toArray();

    // Attach distinct sources per cluster
    const enriched = await Promise.all(
      clusters.map(async (c) => {
        const sources = await db
          .collection("articles")
          .distinct("source", { cluster_id: c._id });
        return { ...normalize(c), sources };
      })
    );

    return res.json({ clusters: enriched, total: enriched.length });
  } catch (err) {
    console.error("GET /clusters error:", err);
    return res.status(500).json({ error: "Failed to fetch clusters" });
  }
});

/**
 * GET /clusters/:id
 * Full cluster detail with all articles sorted chronologically.
 */
router.get("/:id", async (req, res) => {
  let oid;
  try {
    oid = new ObjectId(req.params.id);
  } catch {
    return res.status(400).json({ error: "Invalid cluster ID" });
  }

  try {
    const db = await getDb();

    const cluster = await db.collection("clusters").findOne({ _id: oid });
    if (!cluster) {
      return res.status(404).json({ error: "Cluster not found" });
    }

    const articles = await db
      .collection("articles")
      .find(
        { cluster_id: oid },
        { projection: { body: 0 } } // exclude heavy body field from list view
      )
      .sort({ published_at: 1 })
      .toArray();

    const normalizedArticles = articles.map((a) => normalize(a));

    return res.json({
      cluster: normalize(cluster),
      articles: normalizedArticles,
    });
  } catch (err) {
    console.error(`GET /clusters/${req.params.id} error:`, err);
    return res.status(500).json({ error: "Failed to fetch cluster detail" });
  }
});

export default router;
