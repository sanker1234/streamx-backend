// streamx-backend/providers/base/BaseProvider.js

export class BaseProvider {
  /**
   * @param {string} name - Unique identifier of the provider
   * @param {string} category - "metadata" | "episodes" | "reader" | "streaming"
   */
  constructor(name, category) {
    if (new.target === BaseProvider) {
      throw new TypeError("Cannot construct BaseProvider instances directly");
    }
    if (!name) {
      throw new Error("Provider must have a 'name' property");
    }
    if (!category) {
      throw new Error("Provider must have a 'category' property");
    }
    this.name = name;
    this.category = category;
  }
}
