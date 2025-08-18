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
    unzip && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*



# Install bun globally with npm
RUN npm install -g bun

# Install ElizaOS CLI globally with bun
RUN bun install -g @elizaos/cli

# Set working directory
WORKDIR /app

# Install git (needed for some dependencies)
RUN apk add --no-cache git

# Copy package files first for better caching
COPY package.json package-lock.json bun.lock* ./

# Install dependencies
RUN bun install

# Copy the rest of the application
COPY . .

# Build the application
RUN bun run build

# Create a non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S eliza -u 1001

# Change ownership of the app directory
RUN chown -R eliza:nodejs /app

# Switch to non-root user
USER eliza

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

# Expose port (adjust if needed based on your application)
EXPOSE 3000


# Start the application
CMD ["elizaos", "start"]
