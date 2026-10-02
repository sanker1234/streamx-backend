// streamx-backend/providers/base/EpisodeProvider.js
import { BaseProvider } from "./BaseProvider.js";

export class EpisodeProvider extends BaseProvider {
  constructor(name) {
    super(name, "episodes");
  }

  /**
   * Fetch episodes for a specific media item.
   * @param {string|number} id
   * @param {number} page
   */
  async fetchEpisodes(id, page) {
    throw new Error("fetchEpisodes method not implemented");
  }

  /**
   * Fetch specific source information for an episode.
   * @param {string} episodeId
   */
  async fetchEpisodeSources(episodeId) {
    throw new Error("fetchEpisodeSources method not implemented");
  }
}
