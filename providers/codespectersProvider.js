// streamx-backend/providers/codespectersProvider.js
import { StreamingProvider } from "./base/StreamingProvider.js";

export class CodeSpectersProvider extends StreamingProvider {
  constructor() {
    super("codespecters");
  }

  async fetchStreamSources(id, options = {}) {
    const { mediaType, season, episode } = options;
    const isTV = mediaType === "tv";
    const embedUrl = isTV
      ? `https://api.codespecters.com/embed/tv/${id}/${season || 1}/${episode || 1}?apikey=DEMO_36c18c69`
      : `https://api.codespecters.com/embed/movie/${id}?apikey=DEMO_36c18c68`;

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
