import Redis from 'ioredis';
import { env } from './env';
import { logger } from './logger';

export interface IRedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<'OK' | null>;
  setex(key: string, seconds: number, value: string): Promise<'OK' | null>;
  del(key: string): Promise<number>;
  exists(key: string): Promise<number>;
}

class MemoryRedis implements IRedisClient {
  private store = new Map<string, { value: string; expiresAt: number | null }>();

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string): Promise<'OK' | null> {
    this.store.set(key, { value, expiresAt: null });
    return 'OK';
  }

  async setex(key: string, seconds: number, value: string): Promise<'OK' | null> {
    const expiresAt = Date.now() + seconds * 1000;
    this.store.set(key, { value, expiresAt });
    return 'OK';
  }

  async del(key: string): Promise<number> {
    const deleted = this.store.delete(key);
    return deleted ? 1 : 0;
  }

  async exists(key: string): Promise<number> {
    const val = await this.get(key);
    return val !== null ? 1 : 0;
  }
}

let redisClient: IRedisClient;

if (env.REDIS_ENABLED) {
  try {
    const client = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 2,
      retryStrategy(times) {
        if (times > 2) {
          logger.warn('Redis connection failed 2 times. Shutting down connection attempts and falling back to in-memory store.');
          return null; // Stop retrying
        }
        return Math.min(times * 500, 2000);
      },
    });

    client.on('error', (err) => {
      logger.error('Redis connection error: ' + err.message);
    });

    client.on('connect', () => {
      logger.info('Redis connection established successfully.');
    });

    redisClient = client;
  } catch (error: any) {
    logger.error('Failed to initialize Redis client: ' + error.message);
    redisClient = new MemoryRedis();
  }
} else {
  logger.info('Redis is disabled. Using in-memory database fallback.');
  redisClient = new MemoryRedis();
}

export default redisClient;
