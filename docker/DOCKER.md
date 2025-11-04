# Docker Setup for Spartan

This directory contains Docker configuration files for running the Spartan project in containers.

## Files

- `Dockerfile` - Production Docker image
- `Dockerfile.dev` - Development Docker image with hot-reload
- `Dockerfile.docs` - Documentation server image
- `docker-compose.yml` - Production Docker Compose configuration with MySQL and Redis
- `docker-compose.dev.yml` - Development Docker Compose configuration
- `.dockerignore` - Files to exclude from Docker builds
- `package.json.docker` - Package configuration for Docker builds (without workspace dependencies)
- `mysql/init/` - MySQL initialization scripts

## Quick Start

### Production Mode

```bash
# From spartan root directory
docker-compose up -d
```

This will start:
- MySQL 9.1.0 database on port 3307
- Redis cache on port 6380
- Spartan application on port 3002

### Development Mode

```bash
# From spartan root directory
docker-compose -f docker-compose.dev.yml up
```

This enables hot-reload for development.

## Services

### MySQL
- **Container**: spartan-mysql
- **Port**: 3307 (mapped from 3306)
- **Database**: spartan_db
- **User**: spartan_user
- **Password**: spartan_secret
- **Root Password**: rootsecret

### Redis
- **Container**: spartan-redis
- **Port**: 6380 (mapped from 6379)
- **Max Memory**: 512MB with LRU eviction

### Spartan Application
- **Container**: spartan-app
- **Port**: 3002 (mapped from 3000)
- **UDP Ports**: 50000-50100

## Environment Variables

The production compose file includes hardcoded environment variables. For your own deployment:

1. Create a `.env` file in the spartan root directory
2. Update `docker-compose.yml` to use environment variables instead of hardcoded values
3. Reference the `.env` file in your docker-compose configuration

Example `.env` structure:
```
OPENAI_API_KEY=your_key_here
ANTHROPIC_API_KEY=your_key_here
# ... other keys
```

## Volumes

- `mysql_data` - Persistent MySQL data
- `redis_data` - Persistent Redis data
- `./data` - Application data
- `./logs` - Application logs

## Health Checks

All services include health checks:
- MySQL: mysqladmin ping
- Redis: redis-cli ping
- Spartan: HTTP endpoint check at /health

## Network

All services run on the `spartan-network` bridge network.

## Useful Commands

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down

# Remove all data (caution!)
docker-compose down -v

# Rebuild containers
docker-compose up -d --build

# Access MySQL
docker exec -it spartan-mysql mysql -u spartan_user -pspartan_secret spartan_db

# Access Redis
docker exec -it spartan-redis redis-cli

# Access Spartan container
docker exec -it spartan-app bash
```

## Helper Script

Use the `scripts/docker.sh` script from the repository root:

```bash
# Build the Docker image
./scripts/docker.sh build

# Run the container
./scripts/docker.sh run

# Start existing container
./scripts/docker.sh start

# Access container bash
./scripts/docker.sh bash
```

## Troubleshooting

### Port Conflicts
If ports 3307, 6380, or 3002 are already in use, modify the port mappings in `docker-compose.yml`:
```yaml
ports:
  - 'YOUR_PORT:3306'  # for MySQL
```

### Permission Issues
If you encounter permission issues, ensure the directories exist and are writable:
```bash
mkdir -p data logs mysql/init
chmod -R 755 data logs mysql
```

### Database Connection Issues
Ensure the MySQL service is healthy before the Spartan app starts. The compose file includes:
```yaml
depends_on:
  mysql:
    condition: service_healthy
```

### Memory Issues
If Redis runs out of memory, adjust the maxmemory setting in docker-compose.yml:
```yaml
command: redis-server --appendonly yes --maxmemory 1024mb --maxmemory-policy allkeys-lru
```

