# Environment Configuration Guide

## Overview

BucketLab API uses separate environment files for **development** and **production** deployments. This separation ensures that sensitive credentials don't leak between environments and allows for environment-specific configurations.

---

## Environment Files

### `.env.dev` - Development Configuration
**Used by:** `compose.dev.yaml`
**Location:** Root directory (`/home/empire/BucketLab_api/.env.dev`)
**Purpose:** Configuration for local development with Docker Compose

**When to use:**
- Running `docker compose --env-file .env.dev -f compose.dev.yaml up --build`
- Local development on Raspberry Pi or development machine
- Testing microservices locally
- Debugging with live code reload (nodemon)

**Properties:**
```
MONGO_DB_USERNAME=empirical_explorer         # MongoDB root user
MONGO_DB_PASSWORD=hg48s.2s9dFF.EZpoopin     # MongoDB root password
MONGO_DB_DATABASE=bucketlab                  # Default database name
JWT_SECRET=your_dev_secret_key              # Token signing key (dev)
JWT_EXPIRES_IN=7d                           # Token expiration (short for dev)
TUNNEL_TOKEN=your_tunnel_token              # Cloudflare tunnel auth token
APP_RUN_MODE=development                    # Enables dev logging/middleware
```

**Development-Specific Behavior:**
- `NODE_ENV=development` (passed to all services)
- Morgan HTTP logging enabled
- CORS allows all origins (debugging-friendly)
- Hot reload via nodemon on file changes
- Verbose error messages
- All ports exposed for debugging

---

### `.env` - Production Configuration
**Used by:** `compose.production.yaml`
**Location:** Root directory (`/home/empire/BucketLab_api/.env`)
**Purpose:** Configuration for production deployment

**When to use:**
- Running `docker compose --env-file .env -f compose.production.yaml up --build`
- Deploying to production server
- Long-term hosted instances
- External internet-facing applications

**Properties:**
```
MONGO_DB_USERNAME=production_user           # MongoDB production user
MONGO_DB_PASSWORD=secure_production_pass    # Strong production password
MONGO_DB_DATABASE=bucketlab_prod            # Production database name
JWT_SECRET=secure_production_secret         # Secure token signing key
JWT_EXPIRES_IN=24h                          # Longer expiration for production
TUNNEL_TOKEN=production_tunnel_token        # Production tunnel configuration
APP_RUN_MODE=production                     # Disables dev logging
```

**Production-Specific Behavior:**
- `NODE_ENV=production` (passed to all services)
- Morgan logging disabled (reduces overhead)
- CORS restricted to whitelisted origins only
- No live code reload (immutable containers)
- Minimal error messages (security)
- Only app_server port exposed
- More strict healthchecks
- Resource limits enforced

---

## Critical Differences

| Aspect | `.env.dev` | `.env` |
|--------|-----------|--------|
| **Compose File** | compose.dev.yaml | compose.production.yaml |
| **Command** | `docker compose --env-file .env.dev -f compose.dev.yaml up --build` | `docker compose --env-file .env -f compose.production.yaml up` |
| **Code Reload** | Enabled (nodemon) | Disabled (immutable) |
| **CORS Origins** | All allowed | Whitelisted only |
| **Logging** | Verbose (Morgan) | Minimal |
| **Database** | Dev credentials | Production credentials |
| **JWT Expiration** | Short (7d) | Long (24h) |
| **Container Volumes** | Code mounted (live edit) | No code volumes |
| **Healthcheck** | Lenient retries | Strict retries |

---

## File Structure

```
BucketLab_api/
├── .env              ← Production environment file (DO NOT EDIT LIGHTLY)
├── .env.dev          ← Development environment file (edit for local dev)
├── compose.dev.yaml  ← Development compose config (uses .env.dev)
├── compose.production.yaml  ← Production compose config (uses .env)
├── README.md
├── ENVIRONMENT_SETUP.md  ← This file
├── STARTUP_PROCEDURE.md
├── app/              ← API Gateway service code
├── profiles/         ← Profiles microservice code
├── database_servers/
│   ├── authentication/
│   ├── messages/
│   ├── laboratory/
│   └── administration/
└── docker/
    ├── dev/
    │   ├── Dockerfile.app
    │   ├── Dockerfile.mongodb
    │   ├── Dockerfile.profiles
    │   └── ...
    └── prod/
        ├── Dockerfile.app
        ├── Dockerfile.mongodb
        └── ...
```

---

## How Environment Variables Flow

### Development Startup

```
Start Command:
  docker compose -f compose.dev.yaml up --build

     ↓

Docker Compose reads .env.dev:
  TUNNEL_TOKEN=abc123xyz...
  MONGO_DB_USERNAME=empirical_explorer
  JWT_SECRET=dev_secret

     ↓

Substitutes variables in compose.dev.yaml:
  services:
    cloudflared:
      env_file: .env.dev
      environment:
        TUNNEL_TOKEN=${TUNNEL_TOKEN}  ← Becomes: abc123xyz...

     ↓

Passes to container environments:
  Container env vars set to:
    TUNNEL_TOKEN=abc123xyz...
    MONGO_DB_USERNAME=empirical_explorer
    MONGO_URI=mongodb://empirical_explorer:password@mongodb:27017

     ↓

Services can access via process.env:
  const secret = process.env.JWT_SECRET;  // 'dev_secret'
  const token = process.env.TUNNEL_TOKEN;  // 'abc123xyz...'
```

### Production Startup

Same flow, but reads from `.env` instead of `.env.dev`.

---

## Security Considerations

### Development (`.env.dev`)
```
✓ OK to store:
  - Default/generic credentials
  - Fake test tokens
  - Development secrets
  
✗ NEVER store:
  - Real production passwords
  - Real API keys
  - Real JWT secrets
  - Real user data
```

### Production (`.env`)
```
✓ Must store securely:
  - Actual production passwords (use strong/random)
  - Real JWT secrets (generate with crypto.randomBytes)
  - Real service tokens (from Cloudflare, etc.)
  - Real API keys
  
✗ NEVER commit to git:
  - Delete .env from gitignore enforcement
  - Use environment variables provided by:
    - Docker secrets
    - Docker Compose secrets
    - Kubernetes secrets
    - Environment variable injection at deploy time
```

### Git Configuration
```
.gitignore should contain:
  .env         ← Never commit production secrets
  .env.dev     ← Typically also ignored (unless sharing with team)
  .env.local   ← Machine-specific overrides
```

---

## Common Scenarios

### Scenario 1: Local Development on Your Machine
**Use:** `.env.dev`
```bash
# 1. Create/update .env.dev with dev credentials
echo "MONGO_DB_USERNAME=empirical_explorer" > .env.dev
echo "MONGO_DB_PASSWORD=test123" >> .env.dev
echo "JWT_SECRET=dev_secret_key" >> .env.dev

# 2. Start dev environment
docker compose -f compose.dev.yaml up --build

# 3. Services start with dev configuration
# - Code reloads on file changes
# - CORS allows all origins
# - Verbose logging enabled
```

### Scenario 2: Deploying to Production
**Use:** `.env` (handled by deployment system)
```bash
# 1. Production .env already configured (NOT in git)
# 2. Never edit .env locally - use your deployment pipeline

# 3. Deploy command
docker compose -f compose.production.yaml up --build

# 4. Services start with production configuration
# - Code immutable in containers
# - CORS restricted to known origins
# - Minimal logging
# - Strict security checks
```

### Scenario 3: Switching Between Environments
**Problem:** You were running production, now want to dev
```bash
# Stop production
docker compose -f compose.production.yaml down

# Start development (automatically uses .env.dev)
docker compose -f compose.dev.yaml up --build

# Services now use development configuration from .env.dev
```

### Scenario 4: Testing Different Configs Locally
**Problem:** Want to test two different MongoDB instances
```bash
# Solution: Create .env.dev.test
# Edit compose.dev.yaml temporarily:
env_file: .env.dev.test

# Or use environment variable override:
MONGO_DB_USERNAME=test_user docker compose -f compose.dev.yaml up --build
```

---

## Checking Which Environment Variables Are Loaded

### Method 1: Check which env file is being used
```bash
# Look at compose.dev.yaml
grep "env_file:" compose.dev.yaml
# Output: env_file: .env.dev

# Look at compose.production.yaml
grep "env_file:" compose.production.yaml
# Output: env_file: .env
```

### Method 2: View environment variables in running container
```bash
# Development
docker exec app_server_dev env | grep MONGO_DB

# Production
docker exec app_server_prod env | grep MONGO_DB
```

### Method 3: Check logs for environment info
```bash
docker compose -f compose.dev.yaml logs | grep "NODE_ENV\|development\|production"
```

---

## Environment Variable Reference

### MongoDB Configuration
| Variable | Purpose | Dev Example | Prod Example |
|----------|---------|-------------|--------------|
| `MONGO_DB_USERNAME` | MongoDB root user | `empirical_explorer` | `prod_user` |
| `MONGO_DB_PASSWORD` | MongoDB password | `test123` | `secure_random_password` |
| `MONGO_DB_DATABASE` | Database name | `bucketlab` | `bucketlab_prod` |
| `MONGO_URI` | Full connection string | Set by compose | Set by compose |

### JWT Configuration
| Variable | Purpose | Dev Example | Prod Example |
|----------|---------|-------------|--------------|
| `JWT_SECRET` | Token signing key | `dev_secret` | `crypto_random_bytes` |
| `JWT_EXPIRES_IN` | Token lifetime | `7d` | `24h` |

### Network Configuration
| Variable | Purpose | Dev Example | Prod Example |
|----------|---------|-------------|--------------|
| `TUNNEL_TOKEN` | Cloudflare tunnel auth | `test_token` | `real_tunnel_token` |
| `PORT` | Service port | `4020` | `4020` |

### Runtime Configuration
| Variable | Purpose | Dev Example | Prod Example |
|----------|---------|-------------|--------------|
| `NODE_ENV` | Node environment | `development` | `production` |
| `APP_RUN_MODE` | Custom run mode | `development` | `production` |

---

## Troubleshooting Environment Issues

### Problem: "MONGO_DB_USERNAME is undefined"
**Possible Causes:**
1. Missing `.env.dev` file in root directory
2. `.env.dev` exists but is empty
3. Compose file is looking at wrong location

**Solution:**
```bash
# Check file exists
ls -la .env.dev

# Check file has content
cat .env.dev

# Verify compose points to correct file
grep "env_file:" compose.dev.yaml
# Should output: env_file: .env.dev
```

### Problem: "mongodb-init authentication failed"
**Possible Causes:**
1. `.env.dev` has wrong credentials
2. Persistent volume has old user that doesn't match `.env.dev`
3. MongoDB initialization failed

**Solution:**
```bash
# Check credentials in .env.dev
cat .env.dev | grep MONGO_DB

# If wrong, update and restart
docker compose -f compose.dev.yaml down -v
docker compose -f compose.dev.yaml up --build
```

### Problem: "Production services won't start - authentication errors"
**Possible Causes:**
1. `.env` file missing or empty
2. Production `.env` has wrong credentials
3. Deploying with `compose.dev.yaml` instead of `compose.production.yaml`

**Solution:**
```bash
# Verify .env exists
ls -la .env

# Verify using correct compose file
docker compose -f compose.production.yaml ps

# Check logs
docker compose -f compose.production.yaml logs mongodb
```

---

## Best Practices

### Do's ✓
- ✓ Use `.env.dev` for all local development
- ✓ Use `.env` for production (managed by deployment)
- ✓ Make `.env` distinct from `.env.dev`
- ✓ Use strong random passwords in production
- ✓ Store production `.env` in secure location
- ✓ Rotate JWT_SECRET periodically
- ✓ Use different MONGO_DB_USERNAME for dev vs prod

### Don'ts ✗
- ✗ Commit `.env` to Git (security risk)
- ✗ Use same credentials for dev and prod
- ✗ Store `.env` in public repositories
- ✗ Mix dev and prod configuration
- ✗ Share `.env` files via insecure channels
- ✗ Hardcode secrets in application code
- ✗ Use simple/obvious passwords

---

## Summary

| Aspect | Development | Production |
|--------|-------------|-----------|
| **File** | `.env.dev` | `.env` |
| **Compose** | `compose.dev.yaml` | `compose.production.yaml` |
| **Use Case** | Local development | Deployed services |
| **Code Reload** | Yes (nodemon) | No |
| **Security** | Relaxed | Strict |
| **Credentials** | Generic/test | Real/secure |
| **Commit to Git** | Typically no | Never |
| **Template** | Check README.md | Check README.md |

For detailed startup information, see [STARTUP_PROCEDURE.md](./STARTUP_PROCEDURE.md).

