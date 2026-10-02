import { StreamingProvider } from "./base/StreamingProvider.js";

export class TwoEmbedProvider extends StreamingProvider {
  constructor() {
    super("twoembed");
  }

  async fetchStreamSources(id, options = {}) {
    const { mediaType, season, episode } = options;
    const isTV = mediaType === "tv";
    const embedUrl = isTV
      ? `https://www.2embed.cc/embedtv/${id}&s=${season}&e=${episode}`
      : `https://www.2embed.cc/embed/${id}`;
    return { embedUrl };
  }
}

export class VidLinkStreamingProvider extends StreamingProvider {
  constructor() {
    super("vidlink");
  }

  async fetchStreamSources(id, options = {}) {
    const { mediaType, season, episode } = options;
    const isTV = mediaType === "tv";
    const embedUrl = isTV
      ? `https://vidlink.pro/tv/${id}/${season || 1}/${episode || 1}`
      : `https://vidlink.pro/movie/${id}`;
    return { embedUrl };
  }
}
