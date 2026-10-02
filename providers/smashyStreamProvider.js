// streamx-backend/providers/smashyStreamProvider.js
import { StreamingProvider } from "./base/StreamingProvider.js";

export class SmashyStreamProvider extends StreamingProvider {
  constructor() {
    super("smashystream");
  }

  async fetchStreamSources(id, options = {}) {
    const { mediaType, season, episode } = options;
    const isTV = mediaType === "tv";
    const embedUrl = isTV
      ? `https://embed.smashystream.com/playere.php?tmdb=${id}&season=${season}&episode=${episode}`
      : `https://embed.smashystream.com/playere.php?tmdb=${id}`;
    return { embedUrl };
  }
}
