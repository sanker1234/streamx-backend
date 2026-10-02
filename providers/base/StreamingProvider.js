// streamx-backend/providers/base/StreamingProvider.js
import { BaseProvider } from "./BaseProvider.js";

export class StreamingProvider extends BaseProvider {
  constructor(name) {
    super(name, "streaming");
  }

  /**
   * Fetch playable stream sources (video URLs, qualities, subtitles) for an episode or media item.
   * @param {string|number} id
   * @param {string} episodeId
   */
  async fetchStreamSources(id, episodeId) {
    throw new Error("fetchStreamSources method not implemented");
  }
}
