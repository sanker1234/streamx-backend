// streamx-backend/providers/readerProviderRegistry.js
//
// Independent registry for ReaderProviders.
// Completely separate from providerRegistry.js — does NOT touch any existing functionality.
//
// Features:
//   • register(provider, priority)  — register with numeric priority (lower = tried first)
//   • getProvider(name)             — get provider by name
//   • getChain()                    — ordered list of providers (healthy first, by priority)
//   • executeWithFallback(method, ...args) — try each provider in order, return first success
//   • runHealthChecks()             — call healthCheck() on every provider, update state
//   • getHealth()                   — current health snapshot for all providers
//   • list()                        — list all provider names and priorities

// ── Health state shape ────────────────────────────────────────────────────────
//  {
//    available: boolean,
//    priority:  number,
//    latencyMs: number | null,
//    lastChecked: number,      // Date.now() timestamp
//    errorType: string | null  // 'timeout' | 'blocked' | 'error' | null
//  }

const DEFAULT_HEALTH = {
  available: true,
  priority: 100,
  latencyMs: null,
  lastChecked: 0,
  errorType: null,
};

function classifyError(err) {
  if (!err) return "unknown";
  const msg = (err.message || "").toLowerCase();
  if (msg.includes("timeout") || err.code === "ECONNABORTED") return "timeout";
  if (
    msg.includes("cloudflare") ||
    msg.includes("forbidden") ||
    msg.includes("403") ||
    (err.response?.status === 403)
  ) return "blocked";
  if (msg.includes("econnrefused") || msg.includes("enotfound") || msg.includes("network")) {
    return "network";
  }
  return "error";
}

class ReaderProviderRegistry {
  constructor() {
    /** @type {Map<string, { provider: object, priority: number }>} */
    this._providers = new Map();

    /** @type {Map<string, object>} name → health state */
    this._health = new Map();
  }

  // ── Registration ──────────────────────────────────────────────────────────

  /**
   * Register a ReaderProvider.
   * @param {import('./base/ReaderProvider.js').ReaderProvider} provider
   * @param {number} [priority=100] - lower number = tried first in fallback chain
   */
  register(provider, priority = 100) {
    if (!provider || !provider.name) {
      throw new Error("ReaderProvider must have a 'name' property");
    }
    if (typeof provider.search !== "function" ||
        typeof provider.chapters !== "function" ||
        typeof provider.chapterPages !== "function" ||
        typeof provider.healthCheck !== "function") {
      throw new Error(
        `Provider '${provider.name}' does not implement the ReaderProvider interface ` +
        "(missing: search, chapters, chapterPages, or healthCheck)"
      );
    }

    this._providers.set(provider.name, { provider, priority });
    this._health.set(provider.name, { ...DEFAULT_HEALTH, priority });
    console.log(`[ReaderRegistry] Registered provider '${provider.name}' (priority ${priority})`);
  }

  // ── Retrieval ─────────────────────────────────────────────────────────────

  /**
   * Get a provider by name.
   * @param {string} name
   * @returns {object} the provider instance
   */
  getProvider(name) {
    const entry = this._providers.get(name);
    if (!entry) {
      throw new Error(`[ReaderRegistry] Provider '${name}' is not registered`);
    }
    return entry.provider;
  }

  /**
   * Returns all registered providers sorted by priority (ascending).
   * Healthy providers come first within the same priority tier.
   * @returns {Array<{ provider: object, priority: number, health: object }>}
   */
  getChain() {
    return Array.from(this._providers.entries())
      .map(([name, entry]) => ({
        provider: entry.provider,
        priority: entry.priority,
        health: this._health.get(name) || { ...DEFAULT_HEALTH },
      }))
      .sort((a, b) => {
        // Healthy providers first, then by priority
        const aOk = a.health.available ? 0 : 1;
        const bOk = b.health.available ? 0 : 1;
        if (aOk !== bOk) return aOk - bOk;
        return a.priority - b.priority;
      });
  }

  // ── Fallback Execution ────────────────────────────────────────────────────

  /**
   * Execute a provider method with automatic fallback.
   * Tries providers in priority order (healthy ones first).
   * Returns the first successful result.
   *
   * @param {string} method - method name: 'search' | 'details' | 'chapters' | 'chapterPages'
   * @param {...any} args - arguments to pass to the method
   * @returns {Promise<any>}
   * @throws {Error} if all providers fail
   */
  async executeWithFallback(method, ...args) {
    const chain = this.getChain();

    if (chain.length === 0) {
      throw new Error("[ReaderRegistry] No reader providers are registered");
    }

    const errors = [];

    for (const { provider, health } of chain) {
      // Only skip a provider if it was explicitly confirmed blocked/down
      // (not just slow — we retry on timeouts)
      if (!health.available && health.errorType === "blocked") {
        console.log(`[ReaderRegistry] Skipping '${provider.name}' — confirmed blocked`);
        continue;
      }

      console.log(`[ReaderRegistry] Trying '${provider.name}' for ${method}(${JSON.stringify(args[0])})`);

      try {
        if (typeof provider[method] !== "function") {
          throw new Error(`Provider '${provider.name}' does not implement '${method}'`);
        }

        const result = await provider[method](...args);

        // Validate result has expected content (not an empty/null response)
        const isEmpty = _isEmptyResult(method, result);
        if (isEmpty) {
          console.warn(`[ReaderRegistry] Provider '${provider.name}' returned empty result for ${method}`);
          errors.push({ provider: provider.name, error: "empty result" });
          continue;
        }

        // Mark provider as healthy since it succeeded
        const healthEntry = this._health.get(provider.name);
        if (healthEntry) {
          healthEntry.available = true;
          healthEntry.errorType = null;
        }

        console.log(`[ReaderRegistry] Success from '${provider.name}' for ${method}`);
        return result;
      } catch (err) {
        console.warn(`[ReaderRegistry] Provider '${provider.name}' failed for ${method}: ${err.message}`);
        const errType = classifyError(err);
        errors.push({ provider: provider.name, error: err.message, errorType: errType });

        // Mark as unavailable if confirmed blocked
        if (errType === "blocked") {
          const healthEntry = this._health.get(provider.name);
          if (healthEntry) {
            healthEntry.available = false;
            healthEntry.errorType = "blocked";
            healthEntry.lastChecked = Date.now();
          }
        }
      }
    }

    const summary = errors.map(e => `${e.provider}: ${e.error}`).join("; ");
    throw new Error(`[ReaderRegistry] All providers failed for ${method}(). Errors: ${summary}`);
  }

  // ── Health Checks ─────────────────────────────────────────────────────────

  /**
   * Run health checks on all registered providers.
   * Updates internal health state. Does not throw.
   * @returns {Promise<Map<string, object>>} updated health map
   */
  async runHealthChecks() {
    console.log("[ReaderRegistry] Running health checks on all providers...");

    const checks = Array.from(this._providers.entries()).map(async ([name, entry]) => {
      const provider = entry.provider;
      const t0 = Date.now();

      try {
        const result = await provider.healthCheck();
        const latencyMs = Date.now() - t0;
        const health = {
          available: result.ok === true,
          priority: entry.priority,
          latencyMs,
          lastChecked: Date.now(),
          errorType: result.ok ? null : (result.error || "unhealthy"),
        };
        this._health.set(name, health);
        console.log(
          `[ReaderRegistry] ${name}: ${result.ok ? "✓ HEALTHY" : "✗ UNHEALTHY"} (${latencyMs}ms)`
          + (result.error ? ` — ${result.error}` : "")
        );
      } catch (err) {
        const latencyMs = Date.now() - t0;
        const health = {
          available: false,
          priority: entry.priority,
          latencyMs,
          lastChecked: Date.now(),
          errorType: classifyError(err),
        };
        this._health.set(name, health);
        console.log(`[ReaderRegistry] ${name}: ✗ HEALTH CHECK THREW — ${err.message}`);
      }
    });

    await Promise.allSettled(checks);
    return this._health;
  }

  /**
   * Get the current health snapshot for all providers.
   * @returns {object} { providerName: { available, priority, latencyMs, lastChecked, errorType } }
   */
  getHealth() {
    const result = {};
    for (const [name, health] of this._health.entries()) {
      result[name] = { ...health };
    }
    return result;
  }

  /**
   * List all registered providers with their name, priority, and current health.
   * @returns {Array<{ name: string, priority: number, health: object }>}
   */
  list() {
    return Array.from(this._providers.entries()).map(([name, entry]) => ({
      name,
      priority: entry.priority,
      health: this._health.get(name) || { ...DEFAULT_HEALTH },
    }));
  }

  /**
   * True if at least one provider is registered.
   * @returns {boolean}
   */
  hasProviders() {
    return this._providers.size > 0;
  }
}

// ── Helper: detect empty/useless results ──────────────────────────────────────

function _isEmptyResult(method, result) {
  if (result == null) return true;
  switch (method) {
    case "search":
      return !result.results || result.results.length === 0;
    case "chapters":
      return !result.chapters || result.chapters.length === 0;
    case "chapterPages":
      return !result.pages || result.pages.length === 0;
    case "details":
      return !result.id && !result.title;
    default:
      return false;
  }
}

// ── Singleton export ──────────────────────────────────────────────────────────

export const readerRegistry = new ReaderProviderRegistry();

// Convenience: start periodic health checks every 10 minutes
export function startReaderHealthChecks(intervalMs = 10 * 60 * 1000) {
  // Run immediately on startup (non-blocking)
  if (readerRegistry.hasProviders()) {
    readerRegistry.runHealthChecks().catch(e =>
      console.error("[ReaderRegistry] Initial health check failed:", e.message)
    );
  }

  setInterval(async () => {
    if (readerRegistry.hasProviders()) {
      try {
        await readerRegistry.runHealthChecks();
      } catch (e) {
        console.error("[ReaderRegistry] Periodic health check error:", e.message);
      }
    }
  }, intervalMs);
}
