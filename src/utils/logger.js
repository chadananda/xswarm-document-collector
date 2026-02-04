import pino from 'pino';

const level = process.env.XSWARM_LOG_LEVEL || 'info';

export const logger = pino({
  level,
  transport: process.env.NODE_ENV !== 'production' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      ignore: 'pid,hostname',
      translateTime: 'HH:MM:ss'
    }
  } : undefined,
  base: {
    pid: process.pid
  },
  serializers: {
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err
  }
});

export function createLogger(name) {
  return logger.child({ module: name });
}
