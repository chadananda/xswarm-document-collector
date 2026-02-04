#!/usr/bin/env node

import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import {
  initDatabase,
  createCollection,
  getCollection,
  listCollections,
  updateCollection,
  deleteCollection
} from '../core/collection-manager.js';

import { defaultScheduler } from '../core/scheduler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkg = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf8'));

const program = new Command();

program
  .name('xswarm-collect')
  .description('Document collection framework')
  .version(pkg.version);

// Add collection command
program
  .command('add <adapter>')
  .description('Add a new collection')
  .option('-n, --name <name>', 'Collection name', 'Unnamed')
  .option('-c, --credentials <file>', 'Credentials JSON file')
  .option('-s, --schedule <cron>', 'Cron schedule')
  .action(async (adapter, options) => {
    const spinner = ora('Creating collection').start();

    try {
      await initDatabase();

      let credentials = {};
      if (options.credentials) {
        credentials = JSON.parse(readFileSync(options.credentials, 'utf8'));
      }

      const collection = await createCollection({
        name: options.name,
        adapter,
        credentials,
        schedule: options.schedule
      });

      spinner.succeed(chalk.green(`Collection created: ${collection.id}`));
      console.log(chalk.dim(`Name: ${collection.name}`));
      console.log(chalk.dim(`Adapter: ${collection.adapter}`));
      if (collection.schedule) {
        console.log(chalk.dim(`Schedule: ${collection.schedule}`));
      }
    } catch (error) {
      spinner.fail(chalk.red(error.message));
      process.exit(1);
    }
  });

// List collections command
program
  .command('list')
  .description('List all collections')
  .option('-a, --adapter <adapter>', 'Filter by adapter')
  .action(async (options) => {
    try {
      await initDatabase();

      const collections = listCollections({
        adapter: options.adapter
      });

      if (collections.length === 0) {
        console.log(chalk.dim('No collections found'));
        return;
      }

      console.log(chalk.bold(`\nCollections (${collections.length}):\n`));

      for (const col of collections) {
        console.log(chalk.cyan(`${col.name} (${col.id})`));
        console.log(chalk.dim(`  Adapter: ${col.adapter}`));
        console.log(chalk.dim(`  Status: ${col.status}`));
        console.log(chalk.dim(`  Enabled: ${col.enabled}`));
        if (col.schedule) {
          console.log(chalk.dim(`  Schedule: ${col.schedule}`));
        }
        console.log();
      }
    } catch (error) {
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  });

// Delete collection command
program
  .command('delete <id>')
  .description('Delete a collection')
  .action(async (id) => {
    const spinner = ora('Deleting collection').start();

    try {
      await initDatabase();
      await deleteCollection(id);
      spinner.succeed(chalk.green('Collection deleted'));
    } catch (error) {
      spinner.fail(chalk.red(error.message));
      process.exit(1);
    }
  });

// Enable/disable collection
program
  .command('enable <id>')
  .description('Enable a collection')
  .action(async (id) => {
    try {
      await initDatabase();
      await updateCollection(id, { enabled: true });
      console.log(chalk.green('Collection enabled'));
    } catch (error) {
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  });

program
  .command('disable <id>')
  .description('Disable a collection')
  .action(async (id) => {
    try {
      await initDatabase();
      await updateCollection(id, { enabled: false });
      console.log(chalk.green('Collection disabled'));
    } catch (error) {
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  });

// Scheduler commands
program
  .command('schedule')
  .description('Manage scheduler')
  .option('-s, --start', 'Start scheduler')
  .option('-t, --stop', 'Stop scheduler')
  .action(async (options) => {
    try {
      await initDatabase();
      await defaultScheduler.scheduleAll();

      if (options.start) {
        defaultScheduler.start();
        console.log(chalk.green('Scheduler started'));
      } else if (options.stop) {
        defaultScheduler.stop();
        console.log(chalk.green('Scheduler stopped'));
      }
    } catch (error) {
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  });

program.parse();
