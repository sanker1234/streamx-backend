import express from "express";
import * as animeController from "../controllers/animeController.js";

const router = express.Router();

router.get("/trending", animeController.getTrending);
router.get("/popular", animeController.getPopular);
router.get("/upcoming", animeController.getUpcoming);
router.get("/airing", animeController.getAiring);
router.get("/search", animeController.getSearch);
router.get("/details/:id", animeController.getDetails);
router.get("/episodes/:id", animeController.getEpisodes);
router.get("/sources/:episodeId", animeController.getEpisodeSources);

export default router;
