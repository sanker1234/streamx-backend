// streamx-backend/providers/cineSrcProvider.js
import { StreamingProvider } from "./base/StreamingProvider.js";

export class CineSrcProvider extends StreamingProvider {
  constructor() {
    super("cinesrc");
  }

  async fetchStreamSources(id, options = {}) {
    const { mediaType, season, episode } = options;
    const isTV = mediaType === "tv";
    const embedUrl = isTV
      ? `https://cinesrc.st/embed/tv/${id}?s=${season || 1}&e=${episode || 1}`
      : `https://cinesrc.st/embed/movie/${id}`;

    return {
      embedUrl,
      capabilities: {
        postMessage: true,
        autoNext: true,
        subtitles: true,
        progress: true,
        playerApi: true
      }
    };
  }
}
