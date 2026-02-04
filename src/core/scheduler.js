import cron from 'node-cron';
import { EventEmitter } from 'events';
import { createLogger } from '../utils/logger.js';
import { listCollections } from './collection-manager.js';

const logger = createLogger('scheduler');

/**
 * Job scheduler for collections
 */
export class Scheduler extends EventEmitter {
  constructor() {
    super();
    this.jobs = new Map();
    this.running = new Map();
  }

  /**
   * Schedule all enabled collections
   */
  async scheduleAll() {
    const collections = listCollections({ enabled: true });

    for (const collection of collections) {
      if (collection.schedule) {
        this.schedule(collection);
      }
    }

    logger.info({ count: this.jobs.size }, 'Scheduled collections');
  }

  /**
   * Schedule a collection
   */
  schedule(collection) {
    if (this.jobs.has(collection.id)) {
      this.unschedule(collection.id);
    }

    const job = cron.schedule(collection.schedule, () => {
      this.runCollection(collection.id);
    }, {
      scheduled: false
    });

    this.jobs.set(collection.id, job);
    logger.info({ id: collection.id, schedule: collection.schedule }, 'Collection scheduled');
  }

  /**
   * Unschedule a collection
   */
  unschedule(collectionId) {
    const job = this.jobs.get(collectionId);
    if (job) {
      job.stop();
      this.jobs.delete(collectionId);
      logger.info({ id: collectionId }, 'Collection unscheduled');
    }
  }

  /**
   * Start all scheduled jobs
   */
  start() {
    for (const [id, job] of this.jobs) {
      job.start();
    }
    logger.info('Scheduler started');
  }

  /**
   * Stop all scheduled jobs
   */
  stop() {
    for (const [id, job] of this.jobs) {
      job.stop();
    }
    logger.info('Scheduler stopped');
  }

  /**
   * Run a collection manually
   */
  async runCollection(collectionId) {
    if (this.running.has(collectionId)) {
      logger.warn({ id: collectionId }, 'Collection already running');
      return;
    }

    this.running.set(collectionId, true);
    this.emit('run:start', { collectionId });

    try {
      // This would integrate with the actual collection runner
      logger.info({ id: collectionId }, 'Running collection');
      // TODO: Implement actual collection run logic
      this.emit('run:complete', { collectionId });
    } catch (error) {
      logger.error({ error: error.message, id: collectionId }, 'Collection run failed');
      this.emit('run:error', { collectionId, error });
    } finally {
      this.running.delete(collectionId);
    }
  }
}

export const defaultScheduler = new Scheduler();
