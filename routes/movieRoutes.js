// streamx-backend/routes/movieRoutes.js
import express from "express";
import * as movieController from "../controllers/movieController.js";

const router = express.Router();

// Mount sources retrieval endpoint
router.get("/sources/:media/:id", movieController.getStreamingSources);

export default router;
