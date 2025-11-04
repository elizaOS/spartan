# Environment Variables Template

This file documents all environment variables needed for Docker deployment.

## How to Use

1. Create a `.env` file in the parent directory (`packages/spartan/.env`)
2. Copy the variables from the `.env.example` file
3. Fill in your actual credentials
4. Run `docker-compose up -d`

## Required Variables

See `../.env.example` for the complete template with all variable names and descriptions.

## Security Notes

- **NEVER** commit `.env` files to version control
- The `.gitignore` is configured to exclude `.env` files
- Use strong, unique passwords for database credentials
- Rotate API keys regularly
- Use environment-specific keys (don't use production keys in development)

## Default Values

Many variables have sensible defaults in `docker-compose.yml` using the syntax `${VAR:-default}`:
- SMTP_HOST: smtp.sendgrid.net
- SMTP_PORT: 587
- NODE_ENV: production
- LOG_LEVEL: info
- Database credentials have defaults but should be changed for production

## Testing Your Configuration

```bash
# Validate without starting
docker-compose config

# Start with your .env file
docker-compose up -d

# View logs to check for errors
docker-compose logs -f
```
