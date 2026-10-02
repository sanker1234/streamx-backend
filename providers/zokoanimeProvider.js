// streamx-backend/providers/zokoanimeProvider.js
import { BaseEmbedProvider, AudioModes, StreamXEvents } from "./base/BaseEmbedProvider.js";

/**
 * Dedicated security & message adapter for ZokoAnime iframe communication.
 */
export class ZokoAnimeMessageAdapter {
  constructor(origin = "https://zokoanime.video") {
    this.origin = origin;
  }

  /**
   * Strictly validates incoming postMessage events.
   * Never trusts wildcard origins or third-party frames.
   */
  isValidEvent(event, expectedContentWindow = null) {
    if (!event) return false;
    if (event.origin !== this.origin) return false;
    if (expectedContentWindow && event.source !== expectedContentWindow) return false;

    const data = event.data;
    if (!data || typeof data !== "object") return false;
    if (data.channel !== "zokoanime") return false;
    if (!data.type || typeof data.type !== "string") return false;

    return true;
  }

  /**
   * Normalizes ZokoAnime's raw message format into StreamX standard events.
   */
  normalize(rawMsg) {
    if (!rawMsg || rawMsg.channel !== "zokoanime") return null;

    switch (rawMsg.type) {
      case "ready":
        return {
          type: StreamXEvents.PLAYER_READY,
          payload: { ...rawMsg }
        };

      case "play":
        return {
          type: StreamXEvents.PLAYER_PLAY,
          payload: {}
        };

      case "pause":
        return {
          type: StreamXEvents.PLAYER_PAUSE,
          payload: {}
        };

      case "watching-log":
        return {
          type: StreamXEvents.PLAYER_PROGRESS,
          payload: {
            position: Number(rawMsg.currentTime) || 0,
            duration: Number(rawMsg.duration) || 0
          }
        };

      case "time":
        return {
          type: StreamXEvents.PLAYER_PROGRESS,
          payload: {
            position: Number(rawMsg.position) || 0,
            duration: Number(rawMsg.duration) || 0,
            percent: Number(rawMsg.percent) || 0
          }
        };

      case "seeked":
        return {
          type: StreamXEvents.PLAYER_SEEK,
          payload: {
            position: Number(rawMsg.position) || 0,
            duration: Number(rawMsg.duration) || 0
          }
        };

      case "skipped":
        return {
          type: rawMsg.name === "outro" ? StreamXEvents.PLAYER_SKIP_OUTRO : StreamXEvents.PLAYER_SKIP_INTRO,
          payload: {
            name: rawMsg.name,
            from: rawMsg.from,
            to: rawMsg.to
          }
        };

      case "ended":
      case "complete":
        return {
          type: StreamXEvents.PLAYER_ENDED,
          payload: {
            autoNext: Boolean(rawMsg.auto_next)
          }
        };

      case "error":
        return {
          type: StreamXEvents.PLAYER_ERROR,
          payload: {
            reason: rawMsg.reason || "playback_error",
            message: rawMsg.message || "An error occurred in ZokoAnime player"
          }
        };

      default:
        return {
          type: `ZOKO_${rawMsg.type.toUpperCase()}`,
          payload: rawMsg
        };
    }
  }

  /**
   * Helper to format secure player control commands sent to the ZokoAnime iframe.
   */
  formatCommand(type, payload = {}) {
    return {
      channel: "zokoanime",
      type,
      ...payload
    };
  }
}

export class ZokoAnimeProvider extends BaseEmbedProvider {
  constructor() {
    super({
      id: "zokoanime",
      name: "ZokoAnime",
      type: "embed",
      origin: "https://zokoanime.video",
      supportedAudioModes: [AudioModes.SUB, AudioModes.DUB, AudioModes.HSUB],
      supportedSubtitleModes: ["vtt"],
      supportsAniList: true,
      supportsMAL: true,
      supportsIframe: true,
      supportsDirectSource: false,
      supportsProgressEvents: true,
      supportsPlayerCommands: true,
      supportsResume: true,
      supportsAutoNext: true,
      supportsAutoSkip: true
    });

    this.messageAdapter = new ZokoAnimeMessageAdapter(this.origin);
  }

  buildEmbedUrl({
    anilistId,
    episode,
    audio = "sub",
    start = 0,
    autoplay = true,
    autoNext = true,
    autoSkip = true,
    accentColor = "35d5bf"
  }) {
    const validId = this.validateAnilistId(anilistId);
    const validEp = this.validateEpisode(episode);
    const validAudio = this.validateAudioMode(audio);

    const params = new URLSearchParams();
    if (accentColor) params.set("color", accentColor.replace("#", ""));
    if (autoplay !== undefined) params.set("autoplay", autoplay ? "1" : "0");
    if (start && start > 0) params.set("time", String(Math.floor(start)));
    if (autoSkip) params.set("asi", "1");
    if (autoNext) params.set("autonext", "1");

    return `${this.origin}/stream/ani/${validId}/${validEp}/${validAudio}?${params.toString()}`;
  }

  validateMessageOrigin(origin) {
    return origin === this.origin;
  }

  parseMessage(eventData) {
    return this.messageAdapter.normalize(eventData);
  }
}
