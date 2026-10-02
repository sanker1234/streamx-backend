import { Router } from "express";
import { proxyTMDB } from "../controllers/tmdbController.js";

const router = Router();

// Catch-all proxy for TMDB API
router.get("/*endpoint", proxyTMDB);

export default router;