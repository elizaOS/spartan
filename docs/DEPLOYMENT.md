# Spartan Deployment Guide

Complete guide for deploying Spartan in development, staging, and production environments.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Development Setup](#development-setup)
3. [Production Deployment](#production-deployment)
4. [Docker Deployment](#docker-deployment)
5. [Cloud Platforms](#cloud-platforms)
6. [Database Setup](#database-setup)
7. [Environment Configuration](#environment-configuration)
8. [Monitoring & Logging](#monitoring--logging)
9. [Backup & Recovery](#backup--recovery)
10. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### System Requirements

**Minimum:**
- CPU: 2 cores
- RAM: 4GB
- Storage: 20GB SSD
- OS: Linux (Ubuntu 20.04+), macOS, Windows with WSL2

**Recommended (Production):**
- CPU: 4+ cores
- RAM: 8GB+
- Storage: 50GB+ SSD
- OS: Linux (Ubuntu 22.04 LTS)

### Software Dependencies

- **Node.js**: v18.0.0 or higher
- **npm** or **yarn**: Latest version
- **MySQL**: 8.0+ or **PostgreSQL**: 14+
- **Redis** (optional): 7.0+ for caching
- **Git**: For version control

---

## Development Setup

### 1. Clone Repository

```bash
git clone https://github.com/your-org/spartan.git
cd spartan
```

### 2. Install Dependencies

```bash
npm install
# or
yarn install
```

### 3. Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit with your favorite editor
nano .env
```

**Minimal Development Config:**
```env
# AI Models (choose at least one)
ANTHROPIC_API_KEY=your_anthropic_key
# or
OPENAI_API_KEY=your_openai_key

# Database
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=spartan_dev

# Blockchain
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

# Required APIs
BIRDEYE_API_KEY=your_birdeye_key
```

### 4. Setup Database

```bash
# Create database
mysql -u root -p -e "CREATE DATABASE spartan_dev;"

# Run migrations (if applicable)
npm run migrate
```

### 5. Start Development Server

```bash
npm run dev
# or
elizaos dev
```

Server will start on `http://localhost:3000` (or configured port).

### 6. Verify Installation

```bash
# Check health endpoint
curl http://localhost:3000/health

# Expected response:
# {"status":"ok","database":"connected","services":"running"}
```

---

## Production Deployment

### Option 1: Traditional Server Deployment

#### 1. Server Preparation

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install MySQL
sudo apt install -y mysql-server

# Install PM2 for process management
sudo npm install -g pm2
```

#### 2. Application Setup

```bash
# Clone repository
cd /opt
sudo git clone https://github.com/your-org/spartan.git
cd spartan

# Install dependencies
npm install --production

# Build application
npm run build
```

#### 3. Configure Environment

```bash
# Create production environment file
sudo nano .env.production
```

```env
NODE_ENV=production

# AI Models
ANTHROPIC_API_KEY=your_production_key
OPENAI_API_KEY=your_production_key

# Database
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=spartan_user
MYSQL_PASSWORD=strong_password_here
MYSQL_DATABASE=spartan_prod

# Blockchain RPCs (use paid tiers)
SOLANA_RPC_URL=https://your-helius-url.rpc.com
HELIUS_API_KEY=your_helius_key

# APIs (production keys)
BIRDEYE_API_KEY=your_prod_key
COINMARKETCAP_API_KEY=your_prod_key

# Security
API_RATE_LIMIT=100
SESSION_SECRET=generate_random_secret_here

# Monitoring
LOG_LEVEL=info
SENTRY_DSN=your_sentry_dsn
```

#### 4. Database Setup

```bash
# Create production database
mysql -u root -p << EOF
CREATE DATABASE spartan_prod;
CREATE USER 'spartan_user'@'localhost' IDENTIFIED BY 'strong_password_here';
GRANT ALL PRIVILEGES ON spartan_prod.* TO 'spartan_user'@'localhost';
FLUSH PRIVILEGES;
EOF

# Run migrations
npm run migrate
```

#### 5. Start with PM2

```bash
# Start application
pm2 start npm --name "spartan" -- start

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
# Run the command it outputs
```

#### 6. Configure Nginx Reverse Proxy

```bash
# Install Nginx
sudo apt install -y nginx

# Create Nginx configuration
sudo nano /etc/nginx/sites-available/spartan
```

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/spartan /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

#### 7. Setup SSL with Let's Encrypt

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtain SSL certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal is configured automatically
```

---

## Docker Deployment

Spartan includes production-ready Docker configuration with MySQL 9.1 and Redis.

### Quick Start

```bash
# From spartan directory
docker-compose up -d
```

This starts:
- **MySQL 9.1.0** on port 3307
- **Redis 7** on port 6380
- **Spartan App** on port 3002

### Docker Files

Spartan includes three Dockerfile configurations:

- **`docker/Dockerfile`** - Production image with Node.js 23.3.0, Bun, and ElizaOS CLI
- **`docker/Dockerfile.dev`** - Development image with hot-reload
- **`docker/Dockerfile.docs`** - Documentation server

### Docker Compose Files

- **`docker-compose.yml`** - Production setup with MySQL, Redis, and Spartan
- **`docker-compose.dev.yml`** - Development setup with source code mounting

### Environment Configuration

Create `.env` file in spartan root:

```env
# AI Models
OPENAI_API_KEY=your_key
ANTHROPIC_API_KEY=your_key

# Database (automatically configured in Docker)
DB_NAME=spartan_db
DB_USER=spartan_user
DB_PASSWORD=spartan_secret
DB_ROOT_PASSWORD=rootsecret

# Blockchain
SOLANA_RPC_URL=your_rpc_url
BIRDEYE_API_KEY=your_key

# Social Platforms
DISCORD_APPLICATION_ID=your_id
DISCORD_API_TOKEN=your_token
```

### Docker Commands

```bash
# Production mode
docker-compose up -d

# Development mode with hot-reload
docker-compose -f docker-compose.dev.yml up

# View logs
docker-compose logs -f spartan

# Stop all services
docker-compose down

# Rebuild and restart
docker-compose up -d --build

# Access container shell
docker exec -it spartan-app bash

# Access MySQL
docker exec -it spartan-mysql mysql -u spartan_user -pspartan_secret spartan_db

# Access Redis
docker exec -it spartan-redis redis-cli
```

### Service Details

#### MySQL 9.1.0
- Port: 3307 (host) → 3306 (container)
- Database: spartan_db
- Optimized InnoDB settings for performance
- Automated initialization via `docker/mysql/init/init.sql`

#### Redis 7
- Port: 6380 (host) → 6379 (container)
- Max memory: 512MB with LRU eviction
- Persistence enabled

#### Spartan Application
- Port: 3002 (host) → 3000 (container)
- UDP ports: 50000-50100
- Health checks enabled
- Auto-restart on failure

### Volumes

- `mysql_data` - Persistent MySQL database
- `redis_data` - Persistent Redis cache
- `./data` - Application data
- `./logs` - Application logs

### Complete Documentation

See **[docker/README.md](../docker/README.md)** and **[docker/DOCKER.md](../docker/DOCKER.md)** for:
- Detailed service configuration
- Security best practices
- Troubleshooting guide
- Advanced usage

---

## Cloud Platforms

### AWS Deployment

#### Using EC2

```bash
# Launch EC2 instance (Ubuntu 22.04 LTS)
# Instance type: t3.medium or larger

# Connect to instance
ssh -i your-key.pem ubuntu@your-ec2-ip

# Follow "Traditional Server Deployment" steps above
```

#### Using ECS (Docker)

1. Build and push Docker image to ECR:
```bash
aws ecr create-repository --repository-name spartan

# Build image
docker build -t spartan .

# Tag and push
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin your-account.dkr.ecr.us-east-1.amazonaws.com
docker tag spartan:latest your-account.dkr.ecr.us-east-1.amazonaws.com/spartan:latest
docker push your-account.dkr.ecr.us-east-1.amazonaws.com/spartan:latest
```

2. Create ECS task definition
3. Create ECS service
4. Configure load balancer

#### Using RDS for Database

```bash
# Create RDS MySQL instance
aws rds create-db-instance \
  --db-instance-identifier spartan-db \
  --db-instance-class db.t3.medium \
  --engine mysql \
  --master-username admin \
  --master-user-password YourPassword123 \
  --allocated-storage 100

# Update .env with RDS endpoint
MYSQL_HOST=spartan-db.xxxxx.us-east-1.rds.amazonaws.com
```

---

### Digital Ocean Deployment

#### Using App Platform

1. Connect GitHub repository
2. Configure build settings:
   - Build command: `npm run build`
   - Run command: `npm start`
3. Add environment variables
4. Deploy

#### Using Droplet

```bash
# Create droplet (Ubuntu 22.04)
# SSH into droplet
ssh root@your-droplet-ip

# Follow "Traditional Server Deployment" steps
```

---

### Google Cloud Platform

#### Using Cloud Run

```bash
# Build container
gcloud builds submit --tag gcr.io/your-project/spartan

# Deploy to Cloud Run
gcloud run deploy spartan \
  --image gcr.io/your-project/spartan \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "NODE_ENV=production" \
  --set-secrets="ANTHROPIC_API_KEY=anthropic-key:latest"
```

#### Using Cloud SQL

```bash
# Create Cloud SQL instance
gcloud sql instances create spartan-db \
  --database-version=MYSQL_8_0 \
  --tier=db-n1-standard-2 \
  --region=us-central1
```

---

## Database Setup

### MySQL Production Setup

```sql
-- Create database
CREATE DATABASE spartan_prod CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create user
CREATE USER 'spartan_user'@'%' IDENTIFIED BY 'strong_password';
GRANT ALL PRIVILEGES ON spartan_prod.* TO 'spartan_user'@'%';
FLUSH PRIVILEGES;

-- Optimize for performance
SET GLOBAL innodb_buffer_pool_size = 2G;
SET GLOBAL max_connections = 200;
```

### Database Migrations

```bash
# Run migrations
npm run migrate

# Rollback last migration
npm run migrate:rollback

# Reset database (CAUTION!)
npm run migrate:reset
```

---

## Environment Configuration

### Production Environment Variables

```env
# ========================================
# Core Settings
# ========================================
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# ========================================
# Database
# ========================================
MYSQL_HOST=your-db-host
MYSQL_PORT=3306
MYSQL_USER=spartan_user
MYSQL_PASSWORD=strong_password
MYSQL_DATABASE=spartan_prod
MYSQL_CONNECTION_LIMIT=20

# ========================================
# Redis Cache (Optional but Recommended)
# ========================================
REDIS_HOST=your-redis-host
REDIS_PORT=6379
REDIS_PASSWORD=redis_password

# ========================================
# AI Models
# ========================================
ANTHROPIC_API_KEY=sk-ant-xxxxx
OPENAI_API_KEY=sk-xxxxx
GROQ_API_KEY=gsk_xxxxx

# ========================================
# Blockchain RPCs (Production Tier)
# ========================================
SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=xxxxx
HELIUS_API_KEY=xxxxx
EVM_PROVIDER_URL=https://base-mainnet.g.alchemy.com/v2/xxxxx

# ========================================
# API Keys
# ========================================
BIRDEYE_API_KEY=xxxxx
COINMARKETCAP_API_KEY=xxxxx
COINGECKO_API_KEY=xxxxx
JUPITER_API_KEY=xxxxx

# ========================================
# Social Platforms
# ========================================
DISCORD_APPLICATION_ID=xxxxx
DISCORD_API_TOKEN=xxxxx
TELEGRAM_BOT_TOKEN=xxxxx
TWITTER_EMAIL=xxxxx
TWITTER_USERNAME=xxxxx
TWITTER_PASSWORD=xxxxx

# ========================================
# Security
# ========================================
API_RATE_LIMIT=100
SESSION_SECRET=generate_random_64_char_string
ENCRYPTION_KEY=generate_random_32_byte_key

# ========================================
# Monitoring
# ========================================
SENTRY_DSN=https://xxxxx@sentry.io/xxxxx
DATADOG_API_KEY=xxxxx

# ========================================
# Feature Flags
# ========================================
ENABLE_TRADING=true
ENABLE_COMMUNITY_INVESTOR=true
ENABLE_MCP_AGENTS=true
```

---

## Monitoring & Logging

### PM2 Monitoring

```bash
# View status
pm2 status

# View logs
pm2 logs spartan

# Monitor resources
pm2 monit

# Generate startup script
pm2 startup
pm2 save
```

### Application Logging

Configure in your application:

```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple(),
  }));
}
```

### Sentry Integration

```bash
npm install @sentry/node
```

```typescript
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
});
```

---

## Backup & Recovery

### Database Backup

#### Automated Backup Script

```bash
#!/bin/bash
# backup-db.sh

BACKUP_DIR="/backups/mysql"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/spartan_$TIMESTAMP.sql.gz"

# Create backup
mysqldump -u spartan_user -p$MYSQL_PASSWORD spartan_prod | gzip > $BACKUP_FILE

# Keep only last 30 days
find $BACKUP_DIR -type f -mtime +30 -delete

echo "Backup completed: $BACKUP_FILE"
```

#### Schedule with Cron

```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * /opt/spartan/backup-db.sh >> /var/log/spartan-backup.log 2>&1
```

### Restore from Backup

```bash
# Decompress and restore
gunzip < backup_file.sql.gz | mysql -u spartan_user -p spartan_prod
```

---

## Troubleshooting

### Common Issues

#### Port Already in Use

```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 PID
```

#### Database Connection Failed

```bash
# Check MySQL is running
sudo systemctl status mysql

# Test connection
mysql -u spartan_user -p -h localhost spartan_prod

# Check firewall
sudo ufw status
sudo ufw allow 3306
```

#### High Memory Usage

```bash
# Check memory
free -h

# Restart PM2
pm2 restart spartan

# Monitor memory
pm2 monit
```

#### Slow API Responses

1. Check RPC endpoint performance
2. Enable Redis caching
3. Optimize database queries
4. Scale horizontally (add more instances)

---

## Performance Optimization

### Nginx Caching

```nginx
# Add to Nginx config
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=api_cache:10m max_size=1g inactive=60m;

location /api/ {
    proxy_cache api_cache;
    proxy_cache_valid 200 5m;
    proxy_cache_key "$scheme$request_method$host$request_uri";
    
    # Add cache headers
    add_header X-Cache-Status $upstream_cache_status;
    
    proxy_pass http://localhost:3000;
}
```

### Database Optimization

```sql
-- Add indexes for common queries
CREATE INDEX idx_user_wallets ON wallets(user_id, created_at DESC);
CREATE INDEX idx_open_positions ON positions(user_id, status) WHERE status = 'open';
CREATE INDEX idx_recent_trades ON trades(wallet_id, created_at DESC);

-- Optimize tables
OPTIMIZE TABLE wallets, positions, trades;
```

### Load Balancing

```nginx
upstream spartan_backend {
    least_conn;
    server localhost:3000 weight=1;
    server localhost:3001 weight=1;
    server localhost:3002 weight=1;
}

server {
    location / {
        proxy_pass http://spartan_backend;
    }
}
```

---

## Security Checklist

- [ ] Use strong passwords for database
- [ ] Enable firewall (UFW/iptables)
- [ ] Configure SSL/TLS certificates
- [ ] Set up rate limiting
- [ ] Enable CORS properly
- [ ] Encrypt sensitive environment variables
- [ ] Regular security updates
- [ ] Monitor for suspicious activity
- [ ] Backup encryption keys securely
- [ ] Use secrets manager (AWS Secrets Manager, etc.)

---

## Maintenance

### Regular Updates

```bash
# Update dependencies
npm update

# Check for security vulnerabilities
npm audit
npm audit fix

# Update system packages
sudo apt update && sudo apt upgrade
```

### Health Checks

```bash
# Create healthcheck endpoint
app.get('/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: await checkDatabase(),
    redis: await checkRedis(),
    rpc: await checkRPC(),
  };
  
  const status = health.database === 'ok' && health.redis === 'ok' ? 200 : 503;
  res.status(status).json(health);
});
```

---

For more information, see:
- [Main README](../README.md)
- [Plugin Documentation](./PLUGINS.md)
- [API Documentation](./API.md)
- [Architecture Documentation](./ARCHITECTURE.md)

