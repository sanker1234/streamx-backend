// streamx-backend/providers/anixoProvider.js
import { BaseEmbedProvider, AudioModes, StreamXEvents } from "./base/BaseEmbedProvider.js";

export class AniXoProvider extends BaseEmbedProvider {
  constructor() {
    super({
      id: "anixo",
      name: "AniXo",
      type: "embed",
      origin: "https://anixo.buzz",
      supportedAudioModes: [AudioModes.SUB, AudioModes.DUB],
      supportedSubtitleModes: ["vtt"],
      supportsAniList: true,
      supportsMAL: true,
      supportsIframe: true,
      supportsDirectSource: false,
      supportsProgressEvents: true,
      supportsPlayerCommands: false,
      supportsResume: false,
      supportsAutoNext: false,
      supportsAutoSkip: true
    });
  }

  buildEmbedUrl({ anilistId, episode, audio = "sub" }) {
    const validId = this.validateAnilistId(anilistId);
    const validEp = this.validateEpisode(episode);
    const validAudio = this.validateAudioMode(audio);

    return `${this.origin}/embed/ani/${validId}/${validEp}?track=${validAudio}`;
  }

  parseMessage(eventData) {
    if (!eventData || typeof eventData !== "object") return null;

    switch (eventData.event || eventData.type) {
      case "ready":
        return { type: StreamXEvents.PLAYER_READY, payload: eventData };
      case "play":
        return { type: StreamXEvents.PLAYER_PLAY, payload: eventData };
      case "pause":
        return { type: StreamXEvents.PLAYER_PAUSE, payload: eventData };
      case "timeupdate":
        return {
          type: StreamXEvents.PLAYER_PROGRESS,
          payload: {
            position: Number(eventData.currentTime) || 0,
            duration: Number(eventData.duration) || 0
          }
        };
      case "ended":
        return { type: StreamXEvents.PLAYER_ENDED, payload: eventData };
      default:
        return null;
    }
  }
}
