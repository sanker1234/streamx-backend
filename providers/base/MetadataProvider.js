// streamx-backend/providers/base/MetadataProvider.js
import { BaseProvider } from "./BaseProvider.js";

export class MetadataProvider extends BaseProvider {
  constructor(name) {
    super(name, "metadata");
  }

  /**
   * Fetch a list of media items.
   * @param {object} opts
   */
  async fetchList(opts) {
    throw new Error("fetchList method not implemented");
  }

  /**
   * Fetch details for a specific media item.
   * @param {string|number} id
   * @param {string} mediaType
   */
  async fetchDetails(id, mediaType) {
    throw new Error("fetchDetails method not implemented");
  }

  /**
   * Search for media items.
   * @param {string} query
   * @param {number} page
   */
  async fetchSearch(query, page) {
    throw new Error("fetchSearch method not implemented");
  }
}
