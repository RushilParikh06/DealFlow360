// B2 OWNED. In-memory + Redis-backed cache for AI responses.
//
// Why cache?  LLM calls add ~1–2 s latency. Dashboard refreshes and page reloads
// should not re-call the API on unchanged data. The cache key includes a hash of
// the full input, so a changed quote automatically produces a cache miss.
//
// Redis is already running (docker-compose.yml REDIS_URL). We use a raw ioredis
// client rather than @nestjs-modules/ioredis to avoid an extra dependency.
//
// All get/set operations are try/catch and never throw — a Redis failure means
// "cache miss, proceed to LLM", not a 500.

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { createHash } from 'crypto';
import { createClient, type RedisClientType } from 'redis';

/** TTL in seconds per feature. These are conservative — adjust as needed. */
const TTL: Record<string, number> = {
  'upsell-reasoning':    1800, // 30 min — product catalogue rarely changes mid-session
  'deal-health-summary':  300, // 5 min  — event state can resolve quickly
  'approval-explanation': 600, // 10 min — explanation does not change until re-evaluation
  'negotiation-hint':     120, // 2 min  — portal sessions are short
};

const DEFAULT_TTL = 300;

@Injectable()
export class AiCacheService implements OnModuleInit {
  private readonly logger = new Logger(AiCacheService.name);
  private client: RedisClientType | null = null;
  private ready = false;

  async onModuleInit(): Promise<void> {
    const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
    try {
      this.client = createClient({ url }) as RedisClientType;
      this.client.on('error', (err: unknown) => {
        this.logger.warn('ai-cache Redis error — cache disabled', err);
        this.ready = false;
      });
      await this.client.connect();
      this.ready = true;
      this.logger.log('AI response cache connected to Redis');
    } catch (err) {
      this.logger.warn('ai-cache: could not connect to Redis — running without cache', err);
    }
  }

  private key(feature: string, input: unknown): string {
    const hash = createHash('sha256')
      .update(JSON.stringify(input))
      .digest('hex')
      .slice(0, 20);
    return `df360:ai:${feature}:${hash}`;
  }

  async get<T>(feature: string, input: unknown): Promise<T | null> {
    if (!this.ready || !this.client) return null;
    try {
      const raw = await this.client.get(this.key(feature, input));
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async set(feature: string, input: unknown, value: unknown): Promise<void> {
    if (!this.ready || !this.client) return;
    const ttl = TTL[feature] ?? DEFAULT_TTL;
    try {
      await this.client.setEx(this.key(feature, input), ttl, JSON.stringify(value));
    } catch (err) {
      this.logger.warn(`ai-cache: set failed for feature "${feature}"`, err);
    }
  }
}
