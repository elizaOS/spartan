FROM node:23.3.0-slim

# Install essential dependencies for the build process
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    ffmpeg \
    g++ \
    git \
    make \
    python3 \
    unzip \
    vim && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install bun globally with npm
RUN npm install -g bun

# Create bun directories and set permissions
RUN mkdir -p /root/.bun /home/node/.bun && \
    chown -R node:node /home/node/.bun

# Add bun global bin to PATH for root and node users
ENV PATH="/root/.bun/bin:/home/node/.bun/bin:/usr/local/bin:/app/node_modules/.bin:$PATH"

# Ensure bun is executable
RUN chmod +x /usr/local/bin/bun || true

# Set working directory
WORKDIR /app

# probably can switch to user node here

# Clone the official ElizaOS monorepo
RUN git config --global http.sslVerify false && \
    git clone https://github.com/elizaos/eliza.git /eliza

# Copy Docker-specific package.json (without workspace dependencies)
COPY docker/package.json.docker ./package.json

# Install ElizaOS CLI globally
RUN bun install -g @elizaos/cli

# Ensure ElizaOS CLI is executable
RUN chmod +x /usr/local/bin/elizaos || true

# Initialize bun project
RUN bun init -y

# Install dependencies
RUN bun install

# Copy the rest of the application
COPY src/ ./src/
COPY index.html ./index.html
COPY vite.config.ts ./vite.config.ts
COPY tsconfig*.json ./
COPY tsup.config.ts ./tsup.config.ts
COPY tailwind.config.js ./tailwind.config.js
COPY postcss.config.js ./postcss.config.js
COPY .env* ./

# Fix permissions for node user
RUN chown -R node:node /app && \
    chmod -R 755 /app && \
    mkdir -p /app/node_modules && \
    chown -R node:node /app/node_modules && \
    chmod -R 777 /app/node_modules && \
    mkdir -p /app/dist && \
    chown -R node:node /app/dist && \
    chmod -R 777 /app/dist

# Switch to node user for the rest of the operations
USER node

# Reinstall dependencies to ensure all packages are available
RUN bun install --ignore-workspace-root-check
#RUN bun install --dev

# Install required plugins using ElizaOS CLI
USER root
RUN elizaos plugins add @elizaos/plugin-bootstrap && \
    elizaos plugins add @elizaos/plugin-sql && \
    elizaos plugins add @elizaos/core && \
    elizaos plugins add @elizaos/plugin-solana && \
    elizaos plugins add @elizaos-plugins/plugin-birdeye

# Switch back to node user for build
USER node

# Build the application
RUN bun run build

# Create node user's bun directory
RUN mkdir -p /home/node/.bun && chown -R node:node /home/node/.bun

# Switch back to root to fix global package permissions
USER root
RUN chown -R node:node /usr/local/lib/node_modules && \
    chown -R node:node /usr/local/bin && \
    find /usr/local -name "elizaos" -type f -exec chmod +x {} \; 2>/dev/null || true

# Switch to non-root user
USER node

# Update PATH for node user to access global packages
ENV PATH="/usr/local/bin:$PATH"

# Environment variables that should be provided at runtime
ARG POSTGRES_URL
ARG LOG_LEVEL
ARG OPENAI_API_KEY
ARG ANTHROPIC_API_KEY
ARG SOLANA_PRIVATE_KEY
ARG SOLANA_PUBLIC_KEY
ARG BIRDEYE_API_KEY
ARG INVESTMENT_MANAGER_DISCORD_APPLICATION_ID
ARG INVESTMENT_MANAGER_DISCORD_API_TOKEN
ARG SMTP_HOST
ARG SMTP_PORT=587
ARG SMTP_USERNAME
ARG SMTP_PASSWORD
ARG SMTP_FROM

# Expose port 
EXPOSE 3000
EXPOSE 50000-50100/udp

# Start the application
WORKDIR /app

# Keep container alive for debugging
CMD ["tail", "-f", "/dev/null"]

