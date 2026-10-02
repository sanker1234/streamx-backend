// streamx-backend/providers/filmuProvider.js
import { StreamingProvider } from "./base/StreamingProvider.js";

export class FilmUProvider extends StreamingProvider {
  constructor() {
    super("filmu");
  }

  async fetchStreamSources(id, options = {}) {
    const { mediaType, season, episode } = options;
    const isTV = mediaType === "tv";
    const embedUrl = isTV
      ? `https://embed.filmu.in/tv/${id}/${season || 1}/${episode || 1}`
      : `https://embed.filmu.in/movie/${id}`;

    return {
      embedUrl,
      capabilities: {}
    };
  }
}
