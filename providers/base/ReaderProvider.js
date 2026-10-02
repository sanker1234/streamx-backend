// streamx-backend/providers/base/ReaderProvider.js
//
// Standard interface that every reading source provider must implement.
//
// Return shapes (all providers must match these exactly):
//
//  search(query, page)
//   → { results: [ { id, title, cover, type, status, lastChapter, provider } ] }
//
//  details(id)
//   → { id, title, cover, description, status, lastChapter, type, provider }
//
//  chapters(id, options)
//   → { id, chapters: [ { id, number, title, uploadedAt, group, groups: [] } ], page, totalPages, provider }
//
//  chapterPages(chapterId)
//   → { chapterId, pages: [ { url, width, height, scrambled } ], provider }
//
//  healthCheck()
//   → { ok: boolean, latencyMs: number, error?: string }
//
//  supportsScanGroups()
//   → boolean

import { BaseProvider } from "./BaseProvider.js";

export class ReaderProvider extends BaseProvider {
  constructor(name) {
    super(name, "reader");
  }

  /**
   * Search for manga/manhwa/manhua by title.
   * @param {string} query - search term
   * @param {number} [page=1] - page number
   * @returns {Promise<{ results: Array<{ id: string, title: string, cover: string, type: string, status: string, lastChapter: string|number, provider: string }> }>}
   */
  async search(query, page = 1) {
    throw new Error(`[${this.name}] search() not implemented`);
  }

  /**
   * Get provider-side details for a series (cover, chapter count, etc.).
   * Note: metadata (description, genres, authors) comes from AniList, not here.
   * @param {string} id - provider-specific series ID
   * @returns {Promise<{ id: string, title: string, cover: string, description: string, status: string, lastChapter: string|number, type: string, provider: string }>}
   */
  async details(id) {
    throw new Error(`[${this.name}] details() not implemented`);
  }

  /**
   * Fetch the chapter list for a series.
   * @param {string} id - provider-specific series ID
   * @param {object} [options]
   * @param {number} [options.page=1]
   * @param {number} [options.limit=30]
   * @param {string} [options.group] - filter by scanlation group ID/name
   * @param {string} [options.sort='desc'] - 'asc' | 'desc'
   * @returns {Promise<{ id: string, chapters: Array<{ id: string, number: string, title: string|null, uploadedAt: string, group: string|null, groups: string[] }>, page: number, totalPages: number, provider: string }>}
   */
  async chapters(id, options = {}) {
    throw new Error(`[${this.name}] chapters() not implemented`);
  }

  /**
   * Fetch page image URLs for a single chapter.
   * @param {string} chapterId - provider-specific chapter ID
   * @returns {Promise<{ chapterId: string, pages: Array<{ url: string, width: number, height: number, scrambled: boolean }>, provider: string }>}
   */
  async chapterPages(chapterId) {
    throw new Error(`[${this.name}] chapterPages() not implemented`);
  }

  /**
   * Health-check this provider. Must resolve (not reject) even if unhealthy.
   * @returns {Promise<{ ok: boolean, latencyMs: number, error?: string }>}
   */
  async healthCheck() {
    throw new Error(`[${this.name}] healthCheck() not implemented`);
  }

  /**
   * Whether this provider exposes per-chapter scanlation group information.
   * @returns {boolean}
   */
  supportsScanGroups() {
    return false;
  }

  // ── Legacy compatibility aliases ─────────────────────────────────────────
  // The old interface had fetchChapters / fetchChapterPages.
  // These delegate to the new methods so any code that calls the old names still works.

  async fetchChapters(id, page = 1) {
    return this.chapters(id, { page });
  }

  async fetchChapterPages(chapterId) {
    return this.chapterPages(chapterId);
  }
}

