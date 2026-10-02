// streamx-backend/routes/mangaRoutes.js
// Routes for /api/manga/* — mounted by server.js at /api/manga
// Does NOT modify animeRoutes.js or tmdbRoutes.js

import express from "express";
import * as mangaController from "../controllers/mangaController.js";

const router = express.Router();

// ── Metadata (AniList) ────────────────────────────────────────────────────────
router.get("/trending",   mangaController.getTrending);
router.get("/popular",    mangaController.getPopular);
router.get("/manhwa",     mangaController.getManhwa);
router.get("/manhua",     mangaController.getManhua);
router.get("/search",     mangaController.getSearch);
router.get("/details/:id", mangaController.getDetails);

// ── Chapters & Pages (ReaderProvider registry with fallback) ─────────────────
router.get("/chapters/:id",       mangaController.getChapters);
router.get("/pages/:chapterId",   mangaController.getChapterPages);

// ── Provider Management ───────────────────────────────────────────────────────
router.get("/providers/health",   mangaController.getProvidersHealth);
router.get("/providers/search",   mangaController.searchProvider);

export default router;
