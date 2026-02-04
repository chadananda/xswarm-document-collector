# CLI Reference

## Installation

```bash
npm install -g xswarm-document-collector
```

## Commands

### Add Collection

```bash
xswarm-collect add <adapter> [options]
```

**Options:**
- `-n, --name <name>` - Collection name
- `-c, --credentials <file>` - JSON credentials file path
- `-s, --schedule <cron>` - Cron schedule expression

**Example:**
```bash
xswarm-collect add gmail \
  --name "My Gmail" \
  --credentials ./gmail-creds.json \
  --schedule "0 */2 * * *"
```

### List Collections

```bash
xswarm-collect list [options]
```

**Options:**
- `-a, --adapter <adapter>` - Filter by adapter type

**Example:**
```bash
xswarm-collect list --adapter gmail
```

### Delete Collection

```bash
xswarm-collect delete <id>
```

**Example:**
```bash
xswarm-collect delete abc-123-def-456
```

### Enable/Disable Collection

```bash
xswarm-collect enable <id>
xswarm-collect disable <id>
```

### Scheduler

```bash
xswarm-collect schedule [options]
```

**Options:**
- `-s, --start` - Start scheduler
- `-t, --stop` - Stop scheduler

**Example:**
```bash
# Start background scheduler
xswarm-collect schedule --start

# Stop scheduler
xswarm-collect schedule --stop
```

## Cron Schedule Format

Cron expressions use 5 fields:
```
* * * * *
│ │ │ │ │
│ │ │ │ └─ Day of week (0-7, Sunday=0 or 7)
│ │ │ └─── Month (1-12)
│ │ └───── Day of month (1-31)
│ └─────── Hour (0-23)
└───────── Minute (0-59)
```

**Examples:**
- `0 * * * *` - Every hour
- `*/15 * * * *` - Every 15 minutes
- `0 9 * * 1` - Every Monday at 9 AM
- `0 0 * * *` - Every day at midnight

## Environment Variables

Set these before running commands:

```bash
export XSWARM_ENCRYPTION_KEY="base64-encoded-key"
export XSWARM_DB_PATH="./xswarm.db"
export XSWARM_LOG_LEVEL="info"
```
