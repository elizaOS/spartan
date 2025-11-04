# Docker Quick Start

## TL;DR

```bash
# From this directory (packages/spartan/)
# 1. Set up environment first
cp .env.example .env
nano .env  # Fill in your API keys

# 2. Start services
docker-compose up -d              # Start production
docker-compose -f docker-compose.dev.yml up  # Start dev mode
docker-compose logs -f            # View logs
docker-compose down               # Stop all
```

## ⚠️ Important: Environment Setup Required

Before running Docker, you **must** create a `.env` file:

```bash
cp .env.example .env
```

Then edit `.env` and add your actual API keys and credentials.

## What's Where

- **This directory**: `docker-compose.yml`, `docker-compose.dev.yml`, `.dockerignore`
- **docker/** subdirectory: Dockerfiles, package.json.docker, MySQL init, full documentation

## Services

- **Spartan App**: Port 3002
- **MySQL 9.1.0**: Port 3307
- **Redis 7**: Port 6380

## Full Documentation

See `docker/DOCKER.md` for complete documentation.

## Structure

```
packages/spartan/
├── docker-compose.yml           # ← Run from here
├── docker-compose.dev.yml       # ← Run from here
├── .dockerignore                # ← Stays at root for build context
├── DOCKER_QUICK_START.md        # ← This file
└── docker/                      # ← All other Docker files
    ├── Dockerfile
    ├── Dockerfile.dev
    ├── Dockerfile.docs
    ├── package.json.docker
    ├── mysql/init/
    ├── DOCKER.md
    ├── DOCKER_MIGRATION.md
    └── README.md
```

## Why This Structure?

- **Convenience**: Run `docker-compose up` without extra flags
- **Clean**: All supporting files are organized in `docker/` subdirectory
- **Standard**: Follows Docker Compose best practices
- **Secure**: No hardcoded credentials - all use environment variables

