import "dotenv/config";
import express from "express";
import cors from "cors";
import "./providers/index.js"; // registers all providers into the registry
import { verifyAllServers, startPeriodicHealthChecks } from "./providers/serverVerifier.js";
import animeRoutes from "./routes/animeRoutes.js";
import tmdbRoutes from "./routes/tmdbRoutes.js";
import mangaRoutes from "./routes/mangaRoutes.js";
import movieRoutes from "./routes/movieRoutes.js";

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Health Check
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "StreamX Backend Running 🚀",
  });
});

// Anime Routes
app.use("/api/anime", animeRoutes);

// Manga / Reading Module Routes (must be before TMDB catch-all)
app.use("/api/manga", mangaRoutes);

// Movie / TV Streaming Routes
app.use("/api/movie", movieRoutes);

// TMDB Proxy Routes (catch-all — must be last under /api)
app.use("/api", tmdbRoutes);

app.listen(PORT, () => {
    console.log(`✅ Backend running on http://localhost:${PORT}`);
    // Run initial verification asynchronously, then start periodic checks
    verifyAllServers().then(() => {
        startPeriodicHealthChecks();
    }).catch(err => {
        console.error("Initial server verification failed:", err);
        startPeriodicHealthChecks();
    });
});