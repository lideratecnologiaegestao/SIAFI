import { Logger } from '@nestjs/common';
import IORedis from 'ioredis';

const logger = new Logger('RedisConnection');

export const redisConnection = new IORedis({
  host: process.env.REDIS_HOST ?? 'localhost',
  port: +(process.env.REDIS_PORT ?? 6379),
  password: process.env.REDIS_PASSWORD,
  tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
  maxRetriesPerRequest: null, // obrigatório BullMQ
  enableReadyCheck: false, // obrigatório Windows Server
  retryStrategy: (times) => Math.min(times * 1000, 30000),
});

redisConnection.on('connect', () => logger.log('Redis conectado'));
redisConnection.on('disconnect', () => logger.warn('Redis desconectado'));
redisConnection.on('error', (err: Error) => logger.error(`Redis erro: ${err.message}`));
