// streamx-backend/providers/embedMasterProvider.js
import { StreamingProvider } from "./base/StreamingProvider.js";

export class EmbedMasterProvider extends StreamingProvider {
  constructor() {
    super("embedmaster");
  }

  async fetchStreamSources(id, options = {}) {
    const { mediaType, season, episode } = options;
    const isTV = mediaType === "tv";
    const embedUrl = isTV
      ? `https://embedmaster.link/tv/${id}/${season || 1}/${episode || 1}`
      : `https://embedmaster.link/movie/${id}`;

    return {
      embedUrl,
      capabilities: {
        postMessage: true,
        playerApi: true,
        subtitles: true,
        noSandbox: true
      }
    };
  }
}
