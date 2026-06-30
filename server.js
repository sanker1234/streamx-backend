import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";
import https from "https";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.TMDB_API_KEY;
const BASE = "https://api.themoviedb.org/3";

// Force IPv4
const httpsAgent = new https.Agent({
    family: 4
});

// Health Check
app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "StreamX Backend Running 🚀"
    });
});

// TMDB Proxy
app.get("/api/{*endpoint}", async (req, res) => {
    try {

        const endpoint = Array.isArray(req.params.endpoint)
            ? req.params.endpoint.join("/")
            : req.params.endpoint;

        const response = await axios.get(
            `${BASE}/${endpoint}`,
            {
                params: {
                    ...req.query,
                    api_key: API_KEY,
                    language: "en-US"
                },
                httpsAgent,
                timeout: 15000
            }
        );

        res.json(response.data);

    } catch (err) {

        console.log("\n========== TMDB ERROR ==========");
        console.log("Code:", err.code);
        console.log("Message:", err.message);

        if (err.response) {
            console.log("Status:", err.response.status);
            console.log("Response:", err.response.data);
        }

        if (err.cause) {
            console.log("Cause:", err.cause);
        }

        console.log("================================\n");

        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

app.listen(PORT, () => {
    console.log(`✅ Backend running on http://localhost:${PORT}`);
});