export interface CacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

export class APICache {
  private memoryCache = new Map<string, CacheItem<any>>();
  private readonly DEFAULT_TTL = 30 * 60 * 1000; // 30 minutes

  /**
   * Generate cache key from endpoint and parameters
   */
  private getCacheKey(endpoint: string, params?: Record<string, any>): string {
    const paramString = params ? JSON.stringify(params) : "";
    return `${endpoint}:${paramString}`;
  }

  /**
   * Check if cache item is still valid
   */
  private isValid<T>(item: CacheItem<T>): boolean {
    return Date.now() - item.timestamp < item.ttl;
  }

  /**
   * Get data from memory cache
   */
  private getFromMemory<T>(key: string): T | null {
    const item = this.memoryCache.get(key);
    if (item && this.isValid(item)) {
      return item.data;
    }
    if (item) {
      this.memoryCache.delete(key); // Clean up expired item
    }
    return null;
  }

  /**
   * Get data from localStorage cache
   */
  private getFromLocalStorage<T>(key: string): T | null {
    if (typeof window === "undefined") return null;

    try {
      const item = localStorage.getItem(`yttv-cache-${key}`);
      if (item) {
        const parsed: CacheItem<T> = JSON.parse(item);
        if (this.isValid(parsed)) {
          return parsed.data;
        }
        localStorage.removeItem(`yttv-cache-${key}`); // Clean up expired item
      }
    } catch (error) {
      // Silently handle localStorage read errors
      localStorage.removeItem(`yttv-cache-${key}`);
    }
    return null;
  }

  /**
   * Set data in memory cache
   */
  private setInMemory<T>(
    key: string,
    data: T,
    ttl: number = this.DEFAULT_TTL
  ): void {
    this.memoryCache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  /**
   * Set data in localStorage cache
   */
  private setInLocalStorage<T>(
    key: string,
    data: T,
    ttl: number = this.DEFAULT_TTL
  ): void {
    if (typeof window === "undefined") return;

    try {
      const item: CacheItem<T> = {
        data,
        timestamp: Date.now(),
        ttl,
      };
      localStorage.setItem(`yttv-cache-${key}`, JSON.stringify(item));
    } catch (error) {
      // Silently handle localStorage write errors (quota, private mode, etc.)
    }
  }

  /**
   * Get cached data (tries memory first, then localStorage)
   */
  get<T>(endpoint: string, params?: Record<string, any>): T | null {
    const key = this.getCacheKey(endpoint, params);

    // Try memory cache first (faster)
    const memoryData = this.getFromMemory<T>(key);
    if (memoryData) {
      return memoryData;
    }

    // Try localStorage cache
    const localData = this.getFromLocalStorage<T>(key);
    if (localData) {
      // Restore to memory cache for faster future access
      this.setInMemory(key, localData);
      return localData;
    }

    return null;
  }

  /**
   * Set cached data (stores in both memory and localStorage)
   */
  set<T>(
    endpoint: string,
    data: T,
    params?: Record<string, any>,
    ttl: number = this.DEFAULT_TTL
  ): void {
    const key = this.getCacheKey(endpoint, params);
    this.setInMemory(key, data, ttl);
    this.setInLocalStorage(key, data, ttl);
  }

  /**
   * Clear specific cache entry
   */
  clear(endpoint: string, params?: Record<string, any>): void {
    const key = this.getCacheKey(endpoint, params);
    this.memoryCache.delete(key);
    if (typeof window !== "undefined") {
      localStorage.removeItem(`yttv-cache-${key}`);
    }
  }

  /**
   * Clear all cache entries
   */
  clearAll(): void {
    this.memoryCache.clear();
    if (typeof window !== "undefined") {
      // Clear all yttv cache entries from localStorage
      const keys = Object.keys(localStorage);
      keys.forEach((key) => {
        if (key.startsWith("yttv-cache-")) {
          localStorage.removeItem(key);
        }
      });
    }
  }

  /**
   * Clean up expired entries from both memory and localStorage
   */
  cleanup(): void {
    // Clean memory cache
    const now = Date.now();
    const entries = Array.from(this.memoryCache.entries());
    for (const [key, item] of entries) {
      if (now - item.timestamp >= item.ttl) {
        this.memoryCache.delete(key);
      }
    }

    // Clean localStorage cache
    if (typeof window !== "undefined") {
      const keys = Object.keys(localStorage);
      keys.forEach((key) => {
        if (key.startsWith("yttv-cache-")) {
          try {
            const item = localStorage.getItem(key);
            if (item) {
              const parsed: CacheItem<any> = JSON.parse(item);
              if (now - parsed.timestamp >= parsed.ttl) {
                localStorage.removeItem(key);
              }
            }
          } catch (error) {
            // Remove corrupted cache entries
            localStorage.removeItem(key);
          }
        }
      });
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): { memorySize: number; localStorageSize: number } {
    const memorySize = this.memoryCache.size;
    let localStorageSize = 0;

    if (typeof window !== "undefined") {
      const keys = Object.keys(localStorage);
      localStorageSize = keys.filter((key) =>
        key.startsWith("yttv-cache-")
      ).length;
    }

    return { memorySize, localStorageSize };
  }

  /**
   * Initialize cache cleanup routine (call once on app start)
   */
  initCleanupRoutine(): void {
    if (typeof window !== "undefined") {
      // Run cleanup every 5 minutes
      setInterval(() => {
        this.cleanup();
      }, 5 * 60 * 1000);

      // Run initial cleanup
      this.cleanup();
    }
  }
}

// Create singleton instance
export const apiCache = new APICache();
