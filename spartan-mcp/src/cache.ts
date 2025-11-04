/**
 * Cache Manager for MCP Gateway
 */

import { CacheConfig, CacheEntry } from './types.js';

export class CacheManager {
  private cache: Map<string, CacheEntry>;
  private config: CacheConfig;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(config: CacheConfig) {
    this.cache = new Map();
    this.config = config;

    if (config.enabled) {
      // Start periodic cleanup
      this.cleanupInterval = setInterval(() => {
        this.cleanup();
      }, 60000); // Clean up every minute
    }
  }

  get<T = any>(key: string): T | null {
    if (!this.config.enabled) {
      return null;
    }

    const prefixedKey = this.getPrefixedKey(key);
    const entry = this.cache.get(prefixedKey);

    if (!entry) {
      return null;
    }

    // Check if entry has expired
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl * 1000) {
      this.cache.delete(prefixedKey);
      return null;
    }

    return entry.data as T;
  }

  set<T = any>(key: string, data: T, ttl?: number): void {
    if (!this.config.enabled) {
      return;
    }

    const prefixedKey = this.getPrefixedKey(key);

    // Check if we need to evict entries
    if (this.cache.size >= this.config.max_entries) {
      this.evictOldest();
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.config.ttl_seconds
    };

    this.cache.set(prefixedKey, entry);
  }

  delete(key: string): void {
    const prefixedKey = this.getPrefixedKey(key);
    this.cache.delete(prefixedKey);
  }

  clear(): void {
    this.cache.clear();
  }

  private getPrefixedKey(key: string): string {
    const prefix = this.config.cache_key_prefix || '';
    return prefix ? `${prefix}${key}` : key;
  }

  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl * 1000) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
    }

    if (keysToDelete.length > 0) {
      console.error(`[Cache] Cleaned up ${keysToDelete.length} expired entries`);
    }
  }

  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTimestamp = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  getStats(): { size: number; maxSize: number; hitRate?: number } {
    return {
      size: this.cache.size,
      maxSize: this.config.max_entries
    };
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clear();
  }
}

export function createCacheManager(config: CacheConfig): CacheManager {
  return new CacheManager(config);
}

