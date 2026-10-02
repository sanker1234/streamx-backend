// streamx-backend/providers/peachifyProvider.js
import { StreamingProvider } from "./base/StreamingProvider.js";

export class PeachifyProvider extends StreamingProvider {
  constructor() {
    super("peachify");
  }

  async fetchStreamSources(id, options = {}) {
    const { mediaType, season, episode } = options;
    const isTV = mediaType === "tv";
    const embedUrl = isTV
      ? `https://peachify.pro/embed/tv/${id}/${season || 1}/${episode || 1}`
      : `https://peachify.pro/embed/movie/${id}`;

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
