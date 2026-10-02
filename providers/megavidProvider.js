// streamx-backend/providers/megavidProvider.js
import { BaseEmbedProvider, AudioModes } from "./base/BaseEmbedProvider.js";

export class MegaVidProvider extends BaseEmbedProvider {
  constructor() {
    super({
      id: "megavid",
      name: "MegaVid",
      type: "embed",
      origin: "https://megavid.buzz",
      supportedAudioModes: [AudioModes.SUB, AudioModes.DUB],
      supportedSubtitleModes: ["vtt", "ass"],
      supportsAniList: true,
      supportsDirectSource: true,
      supportsIframe: true,
      supportsProgressEvents: true
    });
  }

  /**
   * Builds the official MegaVid documented iframe embed URL:
   * GET /ani/{anilist-id}/{ep-num}/{sub|dub}?color=%23...&autoplay=true
   */
  buildEmbedUrl({ anilistId, episode, audio = "sub", autoplay = true, color = "#35d5bf" }) {
    const validId = this.validateAnilistId(anilistId);
    const validEp = this.validateEpisode(episode);
    const validAudio = this.validateAudioMode(audio);

    const cleanColor = typeof color === "string" && color.startsWith("%23") ? decodeURIComponent(color) : color;
    const params = new URLSearchParams();
    if (cleanColor) params.set("color", cleanColor);
    if (autoplay !== false) params.set("autoplay", "true");

    const qs = params.toString();
    return `${this.origin}/ani/${validId}/${validEp}/${validAudio}${qs ? `?${qs}` : ""}`;
  }

  /**
   * Builds the documented JSON source API URL (requires allowed origin)
   */
  buildSourceUrl({ anilistId, episode, audio = "sub" }) {
    const validId = this.validateAnilistId(anilistId);
    const validEp = this.validateEpisode(episode);
    const validAudio = this.validateAudioMode(audio);
    return `${this.origin}/api/ani/${validId}/${validEp}/${validAudio}`;
  }

  /**
   * Resolves episode embed for MegaVid
   */
  async fetchEpisodeSources(episodeNumber, animeId, options = {}) {
    const audio = options.type || options.audio || "sub";
    const embedUrl = this.buildEmbedUrl({
      anilistId: animeId,
      episode: episodeNumber,
      audio,
      autoplay: options.autoplay !== false,
      color: options.color || "%2335d5bf"
    });

    console.log(`[MegaVidProvider] Generated embed URL: ${embedUrl}`);

    return {
      success: true,
      type: "embed",
      provider: "megavid",
      providerName: "megavid",
      displayName: "MegaVid",
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
}
