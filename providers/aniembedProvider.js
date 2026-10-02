// streamx-backend/providers/aniembedProvider.js
import { BaseEmbedProvider, AudioModes } from "./base/BaseEmbedProvider.js";

export class AniEmbedProvider extends BaseEmbedProvider {
  constructor() {
    super({
      id: "aniembed",
      name: "AniEmbed",
      type: "embed",
      origin: "https://aniembed.se",
      supportedAudioModes: [AudioModes.SUB, AudioModes.DUB],
      supportedSubtitleModes: ["vtt"],
      supportsAniList: true,
      supportsIframe: true,
      supportsDirectSource: false,
      supportsResume: true
    });
  }

  buildEmbedUrl({ anilistId, episode, audio = "sub", start = 0, autoplay = true }) {
    const validId = this.validateAnilistId(anilistId);
    const validEp = this.validateEpisode(episode);
    const validAudio = this.validateAudioMode(audio);

    const params = new URLSearchParams();
    params.set("lang", validAudio);
    if (autoplay !== undefined) params.set("autoplay", autoplay ? "1" : "0");
    if (start && start > 0) params.set("t", String(Math.floor(start)));

    return `${this.origin}/e/${validId}/${validEp}?${params.toString()}`;
  }
}
