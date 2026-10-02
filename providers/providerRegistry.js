// streamx-backend/providers/providerRegistry.js
// Category-aware provider registry supporting multiple future providers.
//
// Categories:
//   metadata   → fetchList(opts), fetchDetails(id, mediaType), fetchSearch(query, page)
//   episodes   → fetchEpisodes(id, page), fetchEpisodeSources(episodeId)
//   reader     → fetchChapters(id, page), fetchChapterPages(chapterId)
//   streaming  → fetchStreamSources(id, episodeId)
//
// Usage:
//   registry.register(provider, "metadata")
//   registry.get("anime", "metadata")  → AniList provider
//   registry.list("metadata")          → all metadata providers

class ProviderRegistry {
  constructor() {
    /** @type {Map<string, Map<string, object>>} category → (name → provider) */
    this.categories = new Map();
  }

  /**
   * Register a provider under a category.
   * If category parameter is omitted, it attempts to read provider.category.
   * @param {object} provider - must have a `name` property
   * @param {string} [category] - "metadata" | "episodes" | "reader" | "streaming"
   */
  register(provider, category) {
    if (!provider.name) {
      throw new Error("Provider must have a 'name' property");
    }
    const resolvedCategory = category || provider.category;
    if (!resolvedCategory) {
      throw new Error("Provider must be registered under a category (metadata, episodes, reader, streaming)");
    }
    
    const validCategories = ["metadata", "episodes", "reader", "streaming"];
    if (!validCategories.includes(resolvedCategory)) {
      throw new Error(`Invalid category '${resolvedCategory}'. Must be one of: ${validCategories.join(", ")}`);
    }

    if (!this.categories.has(resolvedCategory)) {
      this.categories.set(resolvedCategory, new Map());
    }
    this.categories.get(resolvedCategory).set(provider.name, provider);
  }

  /**
   * Helper method to register a metadata provider.
   */
  registerMetadata(provider) {
    this.register(provider, "metadata");
  }

  /**
   * Helper method to register an episode provider.
   */
  registerEpisodes(provider) {
    this.register(provider, "episodes");
  }

  /**
   * Helper method to register a reader provider.
   */
  registerReader(provider) {
    this.register(provider, "reader");
  }

  /**
   * Helper method to register a streaming provider.
   */
  registerStreaming(provider) {
    this.register(provider, "streaming");
  }

  /**
   * Get a provider by name and category.
   * @param {string} name
   * @param {string} category
   * @returns {object} the provider
   */
  get(name, category) {
    if (!category) {
      throw new Error("Category must be specified when retrieving a provider");
    }
    const catMap = this.categories.get(category);
    if (!catMap) {
      throw new Error(`Category '${category}' has no registered providers`);
    }
    const provider = catMap.get(name);
    if (!provider) {
      throw new Error(`Provider '${name}' not registered in category '${category}'`);
    }
    return provider;
  }

  /**
   * List all providers in a category, or all categories if no category given.
   * @param {string} [category]
   * @returns {object[] | Map<string, Map<string, object>>}
   */
  list(category) {
    if (category) {
      const catMap = this.categories.get(category);
      return catMap ? Array.from(catMap.values()) : [];
    }
    return this.categories;
  }
}

// Singleton instance
export const registry = new ProviderRegistry();