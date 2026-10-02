// streamx-backend/providers/streamflizoProvider.js
import { StreamingProvider } from "./base/StreamingProvider.js";

export class StreamFlizoProvider extends StreamingProvider {
  constructor() {
    super("streamflizo");
  }

  async fetchStreamSources(id, options = {}) {
    const { mediaType, season, episode } = options;
    const isTV = mediaType === "tv";
    const embedUrl = isTV
      ? `https://streamflizoapi.top/stream/tmdb/${id}/${season || 1}/${episode || 1}/multi`
      : `https://streamflizoapi.top/stream/tmdb/${id}`;

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
