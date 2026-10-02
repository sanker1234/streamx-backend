// streamx-backend/providers/vidboltProvider.js
import { BaseEmbedProvider, AudioModes } from "./base/BaseEmbedProvider.js";
import { StreamingProvider } from "./base/StreamingProvider.js";

export class VidBoltAnimeProvider extends BaseEmbedProvider {
  constructor() {
    super({
      id: "vidbolt",
      name: "VidBolt",
      type: "embed",
      origin: "https://vidbolt.pro",
      supportedAudioModes: [AudioModes.SUB, AudioModes.DUB],
      supportedSubtitleModes: ["vtt"],
      supportsAniList: true,
      supportsIframe: true,
      supportsDirectSource: false,
      supportsResume: true
    });
  }

  buildEmbedUrl({ anilistId, episode, audio = "sub" }) {
    const validId = this.validateAnilistId(anilistId);
    const validEp = this.validateEpisode(episode);
    // User format: https://vidbolt.pro/anime/16498/1
    return `${this.origin}/anime/${validId}/${validEp}`;
  }
}

export class VidBoltStreamingProvider extends StreamingProvider {
  constructor() {
    super("vidbolt");
  }

  async fetchStreamSources(id, options = {}) {
    const { mediaType, season, episode } = options;
    const isTV = mediaType === "tv";
    const embedUrl = isTV
      ? `https://vidbolt.pro/tv/${id}/${season || 1}/${episode || 1}`
      : `https://vidbolt.pro/movie/${id}`;

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
