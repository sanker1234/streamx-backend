import axios from "axios";

try {
    const res = await axios.get("https://www.google.com");
    console.log("Google:", res.status);
} catch (err) {
    console.log("Google Error:", err.code, err.message);
}

try {
    const res = await axios.get("https://api.themoviedb.org/3/configuration");
    console.log("TMDB:", res.status);
} catch (err) {
    console.log("TMDB Error:", err.code, err.message);
}