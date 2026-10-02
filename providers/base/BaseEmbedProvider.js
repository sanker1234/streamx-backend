// streamx-backend/providers/base/BaseEmbedProvider.js
import { BaseProvider } from "./BaseProvider.js";

export const AudioModes = Object.freeze({
  SUB: "sub",
  DUB: "dub",
  HSUB: "hsub"
});

export const StreamXEvents = Object.freeze({
  PLAYER_READY: "PLAYER_READY",
  PLAYER_PLAY: "PLAYER_PLAY",
  PLAYER_PAUSE: "PLAYER_PAUSE",
  PLAYER_PROGRESS: "PLAYER_PROGRESS",
  PLAYER_SEEK: "PLAYER_SEEK",
  PLAYER_ENDED: "PLAYER_ENDED",
  PLAYER_ERROR: "PLAYER_ERROR",
  PLAYER_AUDIO_CHANGED: "PLAYER_AUDIO_CHANGED",
  PLAYER_SUBTITLE_CHANGED: "PLAYER_SUBTITLE_CHANGED",
  PLAYER_SKIP_INTRO: "PLAYER_SKIP_INTRO",
  PLAYER_SKIP_OUTRO: "PLAYER_SKIP_OUTRO",
  PLAYER_EPISODE_CHANGED: "PLAYER_EPISODE_CHANGED"
});

export class BaseEmbedProvider extends BaseProvider {
  /**
   * @param {Object} config
   */
  constructor({
    id,
    name,
    type = "embed", // "embed" | "direct_source"
    origin = "",
    supportedAudioModes = [AudioModes.SUB, AudioModes.DUB],
    supportedSubtitleModes = ["vtt"],
    supportsAniList = true,
    supportsMAL = false,
    supportsIframe = true,
    supportsDirectSource = false,
    supportsProgressEvents = false,
    supportsPlayerCommands = false,
    supportsResume = false,
    supportsAutoNext = false,
    supportsAutoSkip = false,
    supportsServerSelection = false
  }) {
    super(id, type === "direct_source" ? "streaming" : "episodes");
    this.id = id;
    this.displayName = name;
    this.type = type;
    this.origin = origin;
    this.supportedAudioModes = supportedAudioModes;
    this.supportedSubtitleModes = supportedSubtitleModes;
    this.supportsAniList = supportsAniList;
    this.supportsMAL = supportsMAL;
    this.supportsIframe = supportsIframe;
    this.supportsDirectSource = supportsDirectSource;
    this.supportsProgressEvents = supportsProgressEvents;
    this.supportsPlayerCommands = supportsPlayerCommands;
    this.supportsResume = supportsResume;
    this.supportsAutoNext = supportsAutoNext;
    this.supportsAutoSkip = supportsAutoSkip;
    this.supportsServerSelection = supportsServerSelection;
  }

  getCapabilities() {
    return {
      id: this.id,
      name: this.displayName,
      type: this.type,
      origin: this.origin,
      supportedAudioModes: this.supportedAudioModes,
      supportedSubtitleModes: this.supportedSubtitleModes,
      supportsAniList: this.supportsAniList,
      supportsMAL: this.supportsMAL,
      supportsIframe: this.supportsIframe,
      supportsDirectSource: this.supportsDirectSource,
      supportsProgressEvents: this.supportsProgressEvents,
      supportsPlayerCommands: this.supportsPlayerCommands,
      supportsResume: this.supportsResume,
      supportsAutoNext: this.supportsAutoNext,
      supportsAutoSkip: this.supportsAutoSkip,
      supportsServerSelection: this.supportsServerSelection
    };
  }

  validateAudioMode(audio) {
    const normalized = (audio || "sub").toLowerCase();
    if (!this.supportedAudioModes.includes(normalized)) {
      throw new Error(`UNSUPPORTED_AUDIO_MODE: Provider '${this.id}' does not support audio mode '${audio}'. Supported modes: ${this.supportedAudioModes.join(", ")}`);
    }
    return normalized;
  }

  validateAnilistId(anilistId) {
    const id = parseInt(anilistId);
    if (isNaN(id) || id <= 0) {
      throw new Error(`INVALID_ANILIST_ID: Expected positive integer AniList ID, got '${anilistId}'`);
    }
    return id;
  }

  validateEpisode(episode) {
    const ep = parseInt(episode);
    if (isNaN(ep) || ep <= 0) {
      throw new Error(`INVALID_EPISODE: Expected positive integer episode number, got '${episode}'`);
    }
    return ep;
  }

  validateMessageOrigin(eventOrigin) {
    if (!this.origin) return false;
    return eventOrigin === this.origin;
  }

  buildEmbedUrl(options) {
    throw new Error("buildEmbedUrl method not implemented for provider: " + this.id);
  }

  parseMessage(eventData) {
    return null;
  }
}
