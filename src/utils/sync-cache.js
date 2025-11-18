import { readFileSync, writeFileSync, existsSync } from 'fs';
import { createHash } from 'crypto';

export class SyncCache {
  constructor(cacheFilePath = '.sync-cache.json') {
    this.cacheFilePath = cacheFilePath;
    this.cache = this.loadCache();
  }

  /**
   * Loads the cache from disk
   */
  loadCache() {
    if (existsSync(this.cacheFilePath)) {
      try {
        const data = readFileSync(this.cacheFilePath, 'utf8');
        const cache = JSON.parse(data);
        console.log(`✓ Loaded sync cache: ${Object.keys(cache.reviews || {}).length} reviews tracked\n`);
        return cache;
      } catch (error) {
        console.log('⚠️  Failed to load cache, starting fresh\n');
        return this.createEmptyCache();
      }
    }
    console.log('📝 No cache found, first sync will process all reviews\n');
    return this.createEmptyCache();
  }

  /**
   * Creates an empty cache structure
   */
  createEmptyCache() {
    return {
      lastSync: null,
      reviews: {}, // yotpo_id → { hash, lastSynced }
    };
  }

  /**
   * Saves the cache to disk
   */
  saveCache() {
    try {
      writeFileSync(this.cacheFilePath, JSON.stringify(this.cache, null, 2));
      console.log(`\n✓ Cache saved: ${Object.keys(this.cache.reviews).length} reviews tracked`);
    } catch (error) {
      console.error('⚠️  Failed to save cache:', error.message);
    }
  }

  /**
   * Creates a hash of review data to detect changes
   * Only includes fields that matter for display
   */
  createReviewHash(review) {
    const relevantFields = {
      score: review.score,
      title: review.title,
      content: review.content,
      name: review.name,
      votes_up: review.votes_up,
      votes_down: review.votes_down,
      deleted: review.deleted,
      archived: review.archived,
      updated_at: review.updated_at,
    };

    const dataString = JSON.stringify(relevantFields);
    return createHash('md5').update(dataString).digest('hex');
  }

  /**
   * Checks if a review needs to be synced
   * @param {object} review - Yotpo review object
   * @returns {boolean} - True if review should be synced
   */
  needsSync(review) {
    const yotpoId = review.id.toString();
    const currentHash = this.createReviewHash(review);

    // If not in cache, it's new
    if (!this.cache.reviews[yotpoId]) {
      return true;
    }

    // If hash changed, it was updated
    const cachedHash = this.cache.reviews[yotpoId].hash;
    return currentHash !== cachedHash;
  }

  /**
   * Updates the cache for a review after successful sync
   * @param {object} review - Yotpo review object
   */
  markSynced(review) {
    const yotpoId = review.id.toString();
    const hash = this.createReviewHash(review);

    this.cache.reviews[yotpoId] = {
      hash,
      lastSynced: new Date().toISOString(),
    };
  }

  /**
   * Gets sync statistics
   */
  getStats() {
    return {
      totalCached: Object.keys(this.cache.reviews).length,
      lastSync: this.cache.lastSync,
    };
  }

  /**
   * Updates the last sync timestamp
   */
  updateLastSyncTime() {
    this.cache.lastSync = new Date().toISOString();
  }

  /**
   * Clears the cache (for full re-sync)
   */
  clearCache() {
    this.cache = this.createEmptyCache();
    console.log('✓ Cache cleared');
  }
}
