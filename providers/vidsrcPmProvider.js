// streamx-backend/providers/vidsrcPmProvider.js
import { StreamingProvider } from "./base/StreamingProvider.js";

export class VidSrcPmProvider extends StreamingProvider {
  constructor() {
    super("server6"); // map to server6
  }

  async fetchStreamSources(id, options = {}) {
    const { mediaType, season, episode } = options;
    const isTV = mediaType === "tv";
    const embedUrl = isTV
      ? `https://vsrc.su/embed/tv/${id}/${season}/${episode}`
      : `https://vsrc.su/embed/movie/${id}`;
    return { embedUrl };
  }
}
