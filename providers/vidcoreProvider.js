// streamx-backend/providers/vidcoreProvider.js
import { StreamingProvider } from "./base/StreamingProvider.js";

export class VidCoreProvider extends StreamingProvider {
  constructor() {
    super("vidcore");
  }

  async fetchStreamSources(id, options = {}) {
    const { mediaType, season, episode } = options;
    const isTV = mediaType === "tv";
    const embedUrl = isTV
      ? `https://vidcore.org/embed/tv/${id}/${season || 1}/${episode || 1}`
      : `https://vidcore.org/embed/movie/${id}`;

    return {
      embedUrl,
      capabilities: {
        postMessage: true,
        subtitles: true
      }
    };
  }
}
