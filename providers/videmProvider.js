// streamx-backend/providers/videmProvider.js
import { StreamingProvider } from "./base/StreamingProvider.js";

export class VidemProvider extends StreamingProvider {
  constructor() {
    super("videm");
  }

  async fetchStreamSources(id, options = {}) {
    const { mediaType, season, episode } = options;
    const isTV = mediaType === "tv";
    const embedUrl = isTV
      ? `https://videm.xyz/embed/tv/${id}/${season || 1}/${episode || 1}`
      : `https://videm.xyz/embed/movie/${id}`;

    return {
      embedUrl,
      capabilities: {
        postMessage: true,
        resume: true,
        autoNext: true,
        subtitles: true,
        audio: true,
        progress: true
      }
    };
  }
}
