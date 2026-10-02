// streamx-backend/providers/anilinkProvider.js
import { BaseEmbedProvider, AudioModes } from "./base/BaseEmbedProvider.js";

export class AniLinkProvider extends BaseEmbedProvider {
  constructor() {
    super({
      id: "anilink",
      name: "AniLink",
      type: "embed",
      origin: "https://anilink.cc",
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

  buildEmbedUrl({
    anilistId,
    episode,
    audio = "sub",
    start = 0,
    autoplay = true,
    autoNext = true,
    autoSkip = true
  }) {
    const validId = this.validateAnilistId(anilistId);
    const validEp = this.validateEpisode(episode);
    const validAudio = this.validateAudioMode(audio);

    const params = new URLSearchParams();
    params.set("variant", validAudio);
    if (autoplay) params.set("autoplay", "true");
    if (autoNext) params.set("autonext", "true");
    if (autoSkip) {
      params.set("autoskipIntro", "true");
      params.set("autoskipOutro", "true");
    }
    if (start && start > 0) {
      params.set("start", String(Math.floor(start)));
    }

    return `${this.origin}/watch/${validId}/${validEp}?${params.toString()}`;
  }
}
