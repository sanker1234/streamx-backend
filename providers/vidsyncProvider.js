// streamx-backend/providers/vidsyncProvider.js
import { BaseEmbedProvider, AudioModes, StreamXEvents } from "./base/BaseEmbedProvider.js";

export class VidSyncProvider extends BaseEmbedProvider {
  constructor() {
    super({
      id: "vidsync",
      name: "VidSync",
      type: "embed",
      origin: "https://vidsync.pro",
      supportedAudioModes: [AudioModes.SUB, AudioModes.DUB],
      supportedSubtitleModes: ["vtt"],
      supportsAniList: true,
      supportsIframe: true,
      supportsDirectSource: false,
      supportsProgressEvents: true,
      supportsResume: true,
      supportsAutoNext: true,
      supportsAutoSkip: true
    });
  }

  /**
   * Builds the official VidSync documented iframe embed URL:
   * Series: https://vidsync.pro/embed/anime/{anilistId}/{episode}?accent=35d5bf
   * Movie: https://vidsync.pro/embed/anime/{anilistId}?accent=35d5bf
   */
  buildEmbedUrl({
    anilistId,
    episode,
    audio = "sub",
    isMovie = false,
    accent = "35d5bf",
    watermark = null,
    watermarkPosition = "top-left"
  }) {
    const validId = this.validateAnilistId(anilistId);
    const validAudio = this.validateAudioMode(audio);

    let urlPath;
    if (isMovie || !episode) {
      urlPath = `/embed/anime/${validId}`;
    } else {
      const validEp = this.validateEpisode(episode);
      urlPath = `/embed/anime/${validId}/${validEp}`;
    }

    const params = new URLSearchParams();
    if (accent) {
      params.set("accent", String(accent).replace(/^#/, ""));
    }
    if (watermark) {
      params.set("watermark", watermark);
      if (watermarkPosition) {
        params.set("watermarkPosition", watermarkPosition);
      }
    }

    const qs = params.toString();
    return `${this.origin}${urlPath}${qs ? `?${qs}` : ""}`;
  }

  /**
   * Builds the download embed URL:
   * /embed/download/anime/{anilistId} or /embed/download/anime/{anilistId}/{episode}
   */
  buildDownloadUrl({ anilistId, episode }) {
    const validId = this.validateAnilistId(anilistId);
    if (episode) {
      const validEp = this.validateEpisode(episode);
      return `${this.origin}/embed/download/anime/${validId}/${validEp}`;
    }
    return `${this.origin}/embed/download/anime/${validId}`;
  }

  /**
   * Resolves episode embed for VidSync
   */
  async fetchEpisodeSources(episodeNumber, animeId, options = {}) {
    const audio = options.type || options.audio || "sub";
    const isMovie = Boolean(options.isMovie);
    const embedUrl = this.buildEmbedUrl({
      anilistId: animeId,
      episode: episodeNumber,
      audio,
      isMovie,
      accent: options.accent || "35d5bf"
    });

    console.log(`[VidSyncProvider] Generated embed URL: ${embedUrl}`);

    return {
      success: true,
      type: "embed",
      provider: "vidsync",
      providerName: "vidsync",
      displayName: "VidSync",
      embedUrl,
      audio,
      supportedAudioModes: this.supportedAudioModes,
      origin: this.origin,
      sources: [
        {
          url: embedUrl,
          quality: audio.toUpperCase(),
          isEmbed: true,
          audio
        }
      ],
      subtitles: []
    };
  }

  /**
   * Parses postMessage events from VidSync iframe
   */
  parseMessage(eventData) {
    if (!eventData || typeof eventData !== "object") return null;

    if (eventData.type === "VIDSYNC_READY") {
      return { type: StreamXEvents.PLAYER_READY };
    }

    if (eventData.type === "VIDSYNC_ERROR") {
      return {
        type: StreamXEvents.PLAYER_ERROR,
        payload: { error: eventData.error || eventData.message || "Unknown VidSync error" }
      };
    }

    if (eventData.event === "timeupdate" || eventData.type === "timeupdate" || eventData.type === "progress") {
      return {
        type: StreamXEvents.PLAYER_PROGRESS,
        payload: {
          position: Number(eventData.currentTime || eventData.position || 0),
          duration: Number(eventData.duration || 0)
        }
      };
    }

    if (eventData.event === "ended" || eventData.type === "ended") {
      return { type: StreamXEvents.PLAYER_ENDED };
    }

    return null;
  }
}
