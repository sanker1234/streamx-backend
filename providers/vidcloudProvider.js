// streamx-backend/providers/vidcloudProvider.js
import { BaseEmbedProvider, AudioModes, StreamXEvents } from "./base/BaseEmbedProvider.js";

export class VidCloudProvider extends BaseEmbedProvider {
  constructor() {
    super({
      id: "vidcloud",
      name: "VidCloud",
      type: "embed",
      origin: "https://vidcloud.sbs",
      supportedAudioModes: [AudioModes.SUB, AudioModes.DUB],
      supportedSubtitleModes: ["vtt"],
      supportsAniList: true,
      supportsMAL: true,
      supportsIframe: true,
      supportsDirectSource: false,
      supportsProgressEvents: true,
      supportsPlayerCommands: false,
      supportsResume: false,
      supportsAutoNext: true,
      supportsAutoSkip: true
    });
  }

  buildEmbedUrl({ anilistId, episode, audio = "sub", autoplay = true, autoNext = true, autoSkip = true }) {
    const validId = this.validateAnilistId(anilistId);
    const validEp = this.validateEpisode(episode);
    const validAudio = this.validateAudioMode(audio);

    const params = new URLSearchParams();
    params.set("track", validAudio);
    if (autoSkip) params.set("autoSkip", "1");
    if (autoplay) params.set("autoPlay", "1");
    if (autoNext) params.set("autoNext", "1");

    return `${this.origin}/embed/ani/${validId}/${validEp}?${params.toString()}`;
  }

  parseMessage(eventData) {
    if (!eventData || typeof eventData !== "object") return null;

    // VidCloud event normalization
    switch (eventData.event || eventData.type) {
      case "ready":
        return { type: StreamXEvents.PLAYER_READY, raw: eventData };
      case "play":
        return { type: StreamXEvents.PLAYER_PLAY, raw: eventData };
      case "pause":
        return { type: StreamXEvents.PLAYER_PAUSE, raw: eventData };
      case "ended":
        return { type: StreamXEvents.PLAYER_ENDED, raw: eventData };
      case "autoSkip":
        return { type: StreamXEvents.PLAYER_SKIP_INTRO, raw: eventData };
      default:
        return null;
    }
  }
}
