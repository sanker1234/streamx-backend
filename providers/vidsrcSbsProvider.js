// streamx-backend/providers/vidsrcSbsProvider.js
import { StreamingProvider } from "./base/StreamingProvider.js";

export class VidSrcSbsProvider extends StreamingProvider {
  constructor() {
    super("vidsrcsbs");
  }

  async fetchStreamSources(id, options = {}) {
    const { mediaType, season, episode } = options;
    const isTV = mediaType === "tv";
    const embedUrl = isTV
      ? `https://vidsrc.sbs/embed/tv/${id}/${season || 1}/${episode || 1}`
      : `https://vidsrc.sbs/embed/movie/${id}`;

    return {
      embedUrl,
      capabilities: {}
    };
  }
}
