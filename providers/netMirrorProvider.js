// streamx-backend/providers/netMirrorProvider.js
import { StreamingProvider } from "./base/StreamingProvider.js";

export class NetMirrorProvider extends StreamingProvider {
  constructor() {
    super("netmirror");
  }

  async fetchStreamSources(id, options = {}) {
    const { mediaType, season, episode } = options;
    const isTV = mediaType === "tv";
    const embedUrl = isTV
      ? `https://net27.cc/watch-tmdb/${id}?type=tv&season=${season}&episode=${episode}`
      : `https://net27.cc/watch-tmdb/${id}?type=movie`;
    return { embedUrl };
  }
}
