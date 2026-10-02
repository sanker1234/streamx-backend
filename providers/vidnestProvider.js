// streamx-backend/providers/vidnestProvider.js
import { BaseEmbedProvider, AudioModes, StreamXEvents } from "./base/BaseEmbedProvider.js";

export class VidNestProvider extends BaseEmbedProvider {
  constructor() {
    super({
      id: "vidnest",
      name: "VidNest",
      type: "embed",
      origin: "https://vidnest.fun",
      supportedAudioModes: [AudioModes.SUB, AudioModes.DUB],
      supportedSubtitleModes: ["vtt"],
      supportsAniList: true,
      supportsIframe: true,
      supportsDirectSource: false,
      supportsProgressEvents: true,
      supportsResume: true
    });
  }

  buildEmbedUrl({ anilistId, episode, audio = "sub", start = 0 }) {
    const validId = this.validateAnilistId(anilistId);
    const validEp = this.validateEpisode(episode);
    const validAudio = this.validateAudioMode(audio);

    let url = `${this.origin}/anime/${validId}/${validEp}/${validAudio}`;
    if (start && start > 0) {
      url += `?startAt=${Math.floor(start)}`;
    }
    return url;
  }

  parseMessage(eventData) {
    if (!eventData || typeof eventData !== "object") return null;

    if (eventData.event === "timeupdate" || eventData.type === "timeupdate") {
      return {
        type: StreamXEvents.PLAYER_PROGRESS,
        payload: {
          position: Number(eventData.currentTime) || 0,
          duration: Number(eventData.duration) || 0
        }
      };
    }
    return null;
  }
}
