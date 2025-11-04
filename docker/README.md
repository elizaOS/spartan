# Spartan Docker Configuration

This directory contains all Docker-related configuration files for the Spartan project.

## Directory Structure

```
docker/
├── Dockerfile              # Production Docker image
├── Dockerfile.dev         # Development Docker image with hot-reload
├── Dockerfile.docs        # Documentation server image
├── package.json.docker    # Standalone package.json for Docker builds
├── mysql/
│   └── init/
│       └── init.sql       # MySQL database initialization
├── DOCKER.md             # Detailed Docker documentation
├── DOCKER_MIGRATION.md   # Migration history and notes
└── README.md             # This file
```

## Quick Start

All Docker Compose commands should be run from the **spartan root directory**, not from this docker directory:

```bash
# Navigate to spartan directory
cd spartan

# Production mode
docker-compose up -d

# Development mode
docker-compose -f docker-compose.dev.yml up

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## Files Overview

### Dockerfiles

- **Dockerfile**: Production image with Node.js 23.3.0, Bun, ElizaOS CLI, and all dependencies
- **Dockerfile.dev**: Development image with the same stack plus hot-reload support
- **Dockerfile.docs**: Lightweight Bun-based image for serving documentation

### Configuration

- **package.json.docker**: A standalone package.json without monorepo workspace dependencies, used during Docker builds
- **mysql/init/init.sql**: SQL scripts that run automatically when the MySQL container is first created

### Documentation

- **DOCKER.md**: Comprehensive guide covering:
  - Service configuration details
  - Environment variables
  - Volume management
  - Health checks
  - Troubleshooting
  - Security best practices

- **DOCKER_MIGRATION.md**: Historical record of how these files were migrated and organized

## Architecture

The Docker setup consists of three services:

1. **MySQL 9.1.0** - Database with optimized InnoDB settings
2. **Redis 7** - Caching layer with LRU eviction
3. **Spartan App** - The main application with ElizaOS

All services run on a custom bridge network (`spartan-network`) and include health checks.

## Important Notes

✅ **Security**: You must create a `.env` file before deployment:

```bash
cd spartan
cp .env.example .env
nano .env  # Add your actual credentials
```

See `SECURITY_IMPROVEMENTS.md` in this directory for complete details.

✅ **CLI Convenience**: The main compose files (`docker-compose.yml`, `docker-compose.dev.yml`) remain in the parent directory so you can use standard Docker Compose commands without extra flags.

## Helper Script

A helper script is available at the repository root:

```bash
# From repository root
./scripts/docker.sh build  # Build image
./scripts/docker.sh run    # Run container
./scripts/docker.sh start  # Start existing container
./scripts/docker.sh bash   # Access container shell
```

## Ports

- **3002** - Spartan application (HTTP)
- **3307** - MySQL database
- **6380** - Redis cache
- **50000-50100** - UDP ports for additional services

## For More Information

See `DOCKER.md` in this directory for comprehensive documentation.

