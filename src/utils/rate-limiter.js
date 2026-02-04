import { createLogger } from './logger.js';

const logger = createLogger('rate-limiter');

/**
 * Token bucket rate limiter
 */
export class RateLimiter {
  constructor(options = {}) {
    this.maxTokens = options.maxTokens || 100;
    this.refillRate = options.refillRate || 10; // tokens per second
    this.tokens = this.maxTokens;
    this.lastRefill = Date.now();
    this.name = options.name || 'default';
  }

  /**
   * Wait for and consume tokens
   */
  async acquire(tokens = 1) {
    this.refill();

    while (this.tokens < tokens) {
      const waitTime = ((tokens - this.tokens) / this.refillRate) * 1000;
      logger.debug({
        name: this.name,
        tokens: this.tokens,
        needed: tokens,
        waitTime
      }, 'Rate limit wait');

      await this.sleep(Math.min(waitTime, 1000));
      this.refill();
    }

    this.tokens -= tokens;
  }

  /**
   * Refill tokens based on elapsed time
   */
  refill() {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    const tokensToAdd = elapsed * this.refillRate;

    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current token count
   */
  getTokens() {
    this.refill();
    return this.tokens;
  }
}
