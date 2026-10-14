# BucketLab API - Docker Startup Procedure Documentation

## Overview

This document explains the complete startup procedure for the BucketLab API multi-service application. Understanding this process is crucial for debugging issues, optimizing performance, and maintaining the system.

**Start Command:**

Development:
```bash
docker compose --env-file .env.dev -f compose.dev.yaml up --build
```
Production:
``` bash
docker compose --env-file .env -f compose.production.yaml up --build
```

---

## Architecture Overview

The BucketLab API is a **microservices-based architecture** with 8 Docker containers:

### Core Services
1. **cloudflared** - Cloudflare Tunnel for remote access
2. **mongodb** - NoSQL database
3. **mongodb-init** - Database initialization helper
4. **app_server** - API gateway (Port 4020)
5. **profiles_server** - User profile management (Port 4021)
6. **messages_server** - Inter-user messaging (Port 4022)
7. **laboratory_server** - Experimental/lab features (Port 4023)
8. **authentication_server** - JWT auth & user login (Port 4024)
9. **administration_server** - Admin panel & permissions (Port 4025)

### Network
- **Network Name:** `bucketLab_internal` (Docker bridge network)
- **Communication:** Services use internal DNS (`mongodb:27017`, `profiles_server:4021`, etc.)
- **External Access:** Port 4020 (app_server) exposed; others internal only
- **Remote Access:** Cloudflare Tunnel (`cloudflared`) for external connectivity

### Persistent Storage
- **mongodb_data_dev:** MongoDB data directory (persists across restarts)
- **avatars_data_dev:** User avatar uploads directory

---

## Startup Sequence - Step by Step

### Phase 1: Initialization (First ~5-10 seconds)

#### Step 1.1: Docker Compose Reads Configuration
- Parses `compose.dev.yaml` file
- Identifies all service dependencies
- Loads environment variables from `.env.dev` (development environment only)
- Removes orphan containers (if `--remove-orphans` flag used)

**Key Environment Variables Loaded (from .env.dev):**
```
MONGO_DB_USERNAME = empirical_explorer
MONGO_DB_PASSWORD = hg48s.2s9dFF.EZpoopin
MONGO_DB_DATABASE = bucketlab
JWT_SECRET = [from .env.dev]
TUNNEL_TOKEN = [from .env.dev]
```

#### Step 1.2: Image Building
With the `--build` flag, Docker builds any images that need building:

```
Building: app_server (Dockerfile.app)
  └─ Base: node:22-alpine
  └─ Installs: npm dependencies
  └─ Copies: app code
  └─ Exposes: Port 4020

Building: profiles_server (Dockerfile.profiles)
  └─ Base: node:22-alpine
  └─ Installs: npm dependencies
  └─ Copies: profiles code
  └─ Exposes: Port 4021

Building: mongodb (Dockerfile.mongodb)
  └─ Base: mongo:7.0
  └─ Installs: mongosh CLI tool
  └─ Exposes: Port 27017
```

All other services use pre-built images from registries.

---

### Phase 2: Service Startup (Seconds 10-30)

Docker starts services in dependency order. The dependency graph looks like this:

```
cloudflared
    ↓
mongodb (depends on cloudflared:started)
    ↓
mongodb-init (depends on mongodb:healthy)
    ↓
app_server, profiles_server, messages_server, laboratory_server,
authentication_server, administration_server (all depend on mongodb-init:completed_successfully)
```

#### Step 2.1: Cloudflared Starts First
**Container:** `cloudflared_dev`
**Image:** `cloudflare/cloudflared:latest`
**What it does:**
- Reads `TUNNEL_TOKEN` from `.env.dev` (development environment config)
- Establishes secure tunnel to Cloudflare's network
- Allows external access to your local API without exposing your IP
- Provides HTTPS endpoint for remote connections

**Network Mode:** `host` (uses host networking, not the internal bridge)

**Logs:**
```
cloudflared_dev | Tunnel credentials set. Requesting new quick Tunnel for ip.cloudflare.com
cloudflared_dev | Connection REGISTERED  <uuid>
```

**Condition to Continue:** `service_started` (just needs to be running)

---

#### Step 2.2: MongoDB Starts
**Container:** `bucketlab_database_dev`
**Image:** Built from `docker/dev/Dockerfile.mongodb`
**What it does:**
1. Starts MongoDB daemon on port 27017
2. Initializes admin user with credentials from environment variables
3. Creates the `bucketlab` database
4. Enables authentication (root user required for connections)

**Environment Variables Applied:**
```yaml
MONGO_INITDB_ROOT_USERNAME: empirical_explorer
MONGO_INITDB_ROOT_PASSWORD: hg48s.2s9dFF.EZpoopin
MONGO_INITDB_DATABASE: bucketlab
```

**MongoDB Initialization Process:**
- MongoDB detects these `MONGO_INITDB_*` variables
- Creates admin user: `empirical_explorer` with the provided password
- On fresh database (no existing `/data/db`), creates the root user
- On existing database (persistent volume with data), reuses existing user
- Binds to `0.0.0.0:27017` inside container → exposed on `localhost:27017` on host

**Healthcheck:**
```
Test: mongosh --eval "db.version()"
Interval: 10 seconds
Timeout: 5 seconds
Max retries: 15 attempts
Start period: 60 seconds (grace period before first check)
```

This healthcheck:
- Attempts to connect to MongoDB
- Runs `db.version()` command
- If successful, returns exit code 0 (healthy)
- If fails, retries up to 15 times

**Logs (MongoDB is ready):**
```
bucketlab_database_dev | {"t":{"$date":"2026-05-01T15:36:11.228+00:00"},"s":"I","c":"NETWORK","id":22943}
bucketlab_database_dev | Connection accepted on port 27017
```

**Condition to Continue:** `service_healthy` (must pass healthcheck)

---

#### Step 2.3: MongoDB-Init Service Runs
**Container:** `mongodb_init_helper`
**Image:** `mongo:7.0` (official MongoDB image with mongosh)
**What it does:**
1. Waits for MongoDB to be healthy
2. Connects to MongoDB using credentials: `empirical_explorer:password@mongodb:27017/admin`
3. Runs authentication verification: `db.adminCommand('ping')`
4. Confirms user exists and database is ready
5. Exits with code 0 (success)

**Command Executed:**
```javascript
mongosh "mongodb://empirical_explorer:hg48s.2s9dFF.EZpoopin@mongodb:27017/admin?authSource=admin" --eval "
  db.adminCommand('ping');
  print('MongoDB ready with authenticated user');
"
```

**Why This Service Exists:**
- Previous approach used init scripts that would **hang** during execution
- This service is simpler: just verify MongoDB is ready
- Acts as a **synchronization point** before other services connect
- Ensures user authentication works before app services attempt connections

**Logs (Success):**
```
mongodb_init_helper | MongoDB ready with authenticated user
```

**Condition to Continue:** `service_completed_successfully` (must exit with code 0)

---

### Phase 3: Application Services Start (Seconds 35-45)

Once `mongodb-init` completes successfully, **all 6 application services start in parallel**:

#### Step 3.1: App Server (API Gateway)
**Container:** `app_server_dev`
**Build:** `docker/dev/Dockerfile.app`
**Port:** 4020 (exposed to host)
**Code Location:** `./app/` directory

**Environment Variables:**
```
MONGO_URI=mongodb://empirical_explorer:hg48s.2s9dFF.EZpoopin@mongodb:27017/?authSource=admin
NODE_ENV=development
PORT=4020
```

**Startup Process:**
1. npm installs dependencies (from `app/package.json`)
2. Nodemon starts (watches for file changes)
3. Executes `app/server.js`
4. Server listens on port 4020

**Connection Retry Logic:**
```javascript
// If MongoDB connection fails, exponential backoff retry:
// Attempt 1: wait 1 second
// Attempt 2: wait 2 seconds
// Attempt 3: wait 4 seconds
// Attempt 4: wait 8 seconds
// Attempt 5: wait 16 seconds
// Attempts 6-10: wait 30 seconds each
// Total max: ~170 seconds
```

**First Startup Output:**
```
app_server_dev | > app@1.0.0 dev
app_server_dev | > nodemon server.js
app_server_dev | [nodemon] watching directory...
app_server_dev | Server is running on port 4020
app_server_dev | Attempting to connect to MongoDB...
app_server_dev | Database connected successfully
```

**Healthcheck (After 20 seconds):**
- Docker sends HTTP GET to `http://localhost:4020/health`
- Service responds with status
- Continues retrying until healthy

**Logs (Connected):**
```
app_server_dev | GET /health 200 0.800 ms
```

---

#### Step 3.2: Profiles Server
**Container:** `profiles_server_dev`
**Port:** 4021 (internal only)
**Code Location:** `./profiles/` directory

**Responsibilities:**
- User profile creation/retrieval
- Avatar uploads management
- User metadata storage

**Volume Mounts:**
```
./profiles → /usr/src/profiles (code)
./avatars_data_dev → /usr/src/profiles/uploads/avatars (persistence)
```

**Startup Process:** (Same as app_server)
1. npm install
2. Nodemon watch
3. Connect to MongoDB
4. Listen on 4021

---

#### Step 3.3: Messages Server
**Container:** `messages_server_dev`
**Port:** 4022 (internal only)
**Code Location:** `./database_servers/messages/` directory

**Responsibilities:**
- Inter-user messaging
- Message history
- Notification system

**Startup Process:** (Same as others)
1. npm install
2. Nodemon watch
3. Connect to MongoDB
4. Listen on 4022

---

#### Step 3.4: Laboratory Server
**Container:** `laboratory_server_dev`
**Port:** 4023 (internal only)
**Code Location:** `./laboratory/` directory

**Responsibilities:**
- Experimental features
- Feature testing
- Beta functionality

**Volume Mounts:**
```
./laboratory → /usr/src/laboratory (code)
```

**Startup Process:** (Same as others)
1. npm install
2. Nodemon watch
3. Connect to MongoDB
4. Listen on 4023

---

#### Step 3.5: Authentication Server
**Container:** `authentication_server_dev`
**Port:** 4024 (internal only)
**Code Location:** `./database_servers/authentication/` directory

**Responsibilities:**
- JWT token generation
- User login/logout
- Session management
- OAuth/SSO integration

**Environment Variables:**
```
MONGO_URI=...
NODE_ENV=development
PORT=4024
JWT_SECRET=[secret from .env]
JWT_EXPIRES_IN=[expiration time]
```

**Startup Process:** (Same as others)
1. npm install
2. Nodemon watch
3. Connect to MongoDB
4. Listen on 4024

---

#### Step 3.6: Administration Server
**Container:** `administration_server_dev`
**Port:** 4025 (internal only)
**Code Location:** `./database_servers/administration/` directory

**Responsibilities:**
- Admin user management
- Permission/role system
- Global settings
- User access control

**Environment Variables:**
```
MONGO_URI=...
NODE_ENV=development
PORT=4025
JWT_SECRET=[secret from .env]
JWT_EXPIRES_IN=[expiration time]
```

**Startup Process:** (Same as others)
1. npm install
2. Nodemon watch
3. Connect to MongoDB
4. Listen on 4025

---

### Phase 4: Inter-Service Communication Begins (Seconds 45-60)

Once all services are running, they communicate through the internal bridge network:

```
External Client (via Cloudflare Tunnel)
    ↓
cloudflared (secure tunnel)
    ↓
app_server:4020 (API Gateway)
    ├─→ authentication_server:4024 (auth verification)
    ├─→ profiles_server:4021 (user data)
    ├─→ messages_server:4022 (messaging)
    ├─→ laboratory_server:4023 (features)
    ├─→ administration_server:4025 (admin functions)
    └─→ mongodb:27017 (all services)
```

**Service Discovery:**
- Services use Docker's internal DNS
- Example: `http://profiles_server:4021`
- Docker's DNS resolves to the container's internal IP
- No manual IP configuration needed

**Database Connection Pooling:**
- Each service maintains connection pool to MongoDB
- Default: 10-20 connections per service
- Mongoose handles connection lifecycle
- Automatic reconnection with exponential backoff if connection drops

---

## Health Status Timeline

Here's what a healthy system looks like:

```
Time     Event                                    Status
────────────────────────────────────────────────────────
0s       Docker Compose starts                    ◯ Starting
2s       cloudflared tunnel established          ✓ Healthy
5s       MongoDB container running               ◯ Starting (waiting for healthcheck)
35s      MongoDB healthcheck passes              ✓ Healthy
37s      mongodb-init service completes          ✓ Completed
38s      App services start in parallel          ◯ Starting
45s      All services pass healthchecks          ✓ All Healthy
60s      Inter-service communication begins      ✓ Operational
```

---

## Common Startup Issues & Troubleshooting

### Issue 1: "MongoDB healthcheck timeout"
**Symptom:** Healthcheck fails after 60 seconds
**Cause:** MongoDB takes too long to start on slow hardware (ARM64/Pi)
**Solution:**
```yaml
# In compose.dev.yaml, increase timeout
healthcheck:
  start_period: 120s  # Changed from 60s
  retries: 20         # Changed from 15
```

### Issue 2: "mongodb-init didn't complete successfully"
**Symptom:** Exit code 1, "Command createUser requires authentication"
**Cause:** Using wrong credentials or MongoDB not ready
**Solution:** 
- Verify `.env.dev` file has correct `MONGO_DB_USERNAME` and `MONGO_DB_PASSWORD` (development)
- Verify `.env` file for production environments
- Ensure MongoDB is actually healthy before init runs
- Check if persistent volume has old database without the user

### Issue 3: "Services can't connect to MongoDB"
**Symptom:** "UserNotFound" or "Authentication failed" in service logs
**Cause:** MongoDB-init didn't complete before services started
**Solution:**
- Check `depends_on` conditions are `service_completed_successfully`
- Verify MongoDB healthcheck is passing
- Increase MongoDB start_period if needed

### Issue 4: "Port 4020 already in use"
**Symptom:** "Cannot allocate requested address" or "Address already in use"
**Cause:** Container or host process already using port
**Solution:**
```bash
# Kill existing container
docker compose -f compose.dev.yaml down

# Or kill process on port (macOS/Linux)
lsof -i :4020 | grep LISTEN | awk '{print $2}' | xargs kill -9
```

### Issue 5: "Nodemon not reloading files"
**Symptom:** Code changes not reflected in running container
**Cause:** Volume mount not working or nodemon watching wrong directory
**Solution:**
```bash
# Verify volume mount
docker inspect app_server_dev | grep -A 5 Mounts

# Rebuild with fresh volumes
docker compose -f compose.dev.yaml down -v
docker compose -f compose.dev.yaml up --build
```

---

## Dependency Resolution Algorithm

Docker Compose resolves dependencies in this order:

```
1. Read depends_on entries
2. For each service:
   - Check all dependencies
   - Apply condition (started, healthy, completed_successfully)
   - Wait until condition met before starting
3. Start services in parallel when all dependencies ready
```

**Our Dependency Chain:**
```
cloudflared
    (condition: started)
    ↓
mongodb
    (condition: healthy)
    ↓
mongodb-init
    (condition: completed_successfully)
    ↓
All 6 app services (parallel)
```

**Why This Order?**
- Cloudflared first: provides network/tunnel infrastructure
- MongoDB second: all services need database
- mongodb-init third: verify database is ready
- App services last: they depend on healthy database

---

## Environment Variable Flow

### From Files
**Development Environment:**
```
.env.dev (all development configuration)
    ↓
docker compose -f compose.dev.yaml reads this
    ↓
${VARIABLE_NAME} substitutions in compose.dev.yaml
    ↓
Environment variables passed to containers
```

**Production Environment:**
```
.env (all production configuration)
    ↓
docker compose -f compose.production.yaml reads this
    ↓
${VARIABLE_NAME} substitutions in compose.production.yaml
    ↓
Environment variables passed to containers
```

### Example: MONGO_URI (Development)
```
.env.dev contains:
    MONGO_DB_USERNAME=empirical_explorer
    MONGO_DB_PASSWORD=hg48s.2s9dFF.EZpoopin

compose.dev.yaml references:
    MONGO_URI=mongodb://${MONGO_DB_USERNAME}:${MONGO_DB_PASSWORD}@mongodb:27017/?authSource=admin

Container receives:
    MONGO_URI=mongodb://empirical_explorer:hg48s.2s9dFF.EZpoopin@mongodb:27017/?authSource=admin
```

### Service-Specific Variables
Each service gets:
- `MONGO_URI` - Database connection string (with auth)
- `NODE_ENV` - development/production
- `PORT` - What port to listen on
- `JWT_SECRET` - Signing key for tokens (auth services only)
- `JWT_EXPIRES_IN` - Token TTL (auth services only)

---

## Network Communication Details

### Internal Bridge Network: `bucketLab_internal`

```
Docker Bridge Network (bucketLab_internal)
├─ mongodb (172.18.0.2:27017)
├─ app_server (172.18.0.3:4020)
├─ profiles_server (172.18.0.4:4021)
├─ messages_server (172.18.0.5:4022)
├─ laboratory_server (172.18.0.6:4023)
├─ authentication_server (172.18.0.7:4024)
└─ administration_server (172.18.0.8:4025)
```

**DNS Resolution:**
- Service name resolves to service's IP
- Example: `mongodb:27017` → `172.18.0.2:27017`
- Automatic by Docker's embedded DNS server (127.0.0.11:53)

**Port Mapping:**
```
Internal (Container)          External (Host/Tunnel)
mongodb:27017             →   localhost:27017 (exposed via -p)
app_server:4020           →   localhost:4020 (exposed via -p)
profiles_server:4021      →   (internal only, not exposed)
messages_server:4022      →   (internal only)
laboratory_server:4023    →   (internal only)
authentication_server:4024 →  (internal only)
administration_server:4025 → (internal only)
```

**Cloudflare Tunnel Bridge:**
- cloudflared runs with `network_mode: host`
- Connects to localhost:4020
- Routes external traffic through Cloudflare network
- Creates HTTPS endpoint at tunnel URL

---

## Data Persistence

### MongoDB Data
```
Host Machine                    Docker Container
./data (persistent volume)  ←→  /data/db (MongoDB data dir)
```

**What gets persisted:**
- Database files (all collections)
- Admin user credentials
- Indexes
- Transaction logs

**Initialization on first run:**
1. Volume is empty
2. MongoDB init scripts run
3. Admin user created
4. Root database initialized
5. Data saved to volume

**On subsequent runs:**
1. Volume already has data
2. MongoDB mounts existing volume
3. Skips user creation (already exists)
4. Database state restored

### Avatar Data
```
Host Machine                            Docker Container
./avatars_data_dev (persistent)  ←→  /usr/src/profiles/uploads/avatars
```

**What gets persisted:**
- User avatar image files
- Upload history
- File metadata

---

## Development Mode Specifics

### Hot Reload (Nodemon)
Each Node.js service runs with nodemon:
```dockerfile
CMD ["nodemon", "server.js"]
```

**How it works:**
1. Watches source files in mounted volume
2. Detects changes
3. Automatically restarts Node.js process
4. No container rebuild needed

**Files watched:**
- `.js` files in service directory
- Excludes: node_modules, .git, etc.

**Restart behavior:**
```
You edit: app/server.js
    ↓
nodemon detects change
    ↓
Node.js process kills
    ↓
new Node.js process starts (15-30 seconds)
    ↓
Service reconnects to MongoDB
    ↓
Your changes are live
```

### Live Volume Mounts
```yaml
app_server:
  volumes:
    - ./app:/usr/src/app        # Maps local code to container
    - /usr/src/app/node_modules # Keeps node_modules in container
```

**Why we exclude node_modules:**
- node_modules folder is massive
- Mounting it from host is slow
- Better to keep it in container
- Anonymous volume `/usr/src/app/node_modules` takes precedence

---

## Production vs Development

### Key Differences

**compose.dev.yaml (Development)**
```yaml
restart: always              # Quick restarts for testing
volumes:
  - ./app:/usr/src/app       # Live code reload
environment:
  NODE_ENV: development
healthcheck:
  retries: 3                 # Faster startup
ports:
  - "4020:4020"              # All ports exposed for debugging
networks:
  network_mode: host         # Cloudflared uses host network
```

**compose.production.yaml (Production)**
```yaml
restart: unless-stopped      # Only restart if not explicitly stopped
# No volumes for code        # Immutable containers
environment:
  NODE_ENV: production       # Optimizations enabled
healthcheck:
  retries: 10                # More retries for stability
ports:
  - "4020:4020"              # Only app_server exposed
# Better resource limits     # CPU/memory constraints
```

---

## Monitoring & Debugging

### View Running Services
```bash
docker compose -f compose.dev.yaml ps
```

Shows:
```
NAME                 COMMAND                STATUS
cloudflared_dev      tunnel --no-update    Up (healthy)
bucketlab_database   mongod                Up (healthy)
mongodb_init_helper  mongosh...            Exited (0)
app_server_dev       nodemon server.js     Up (healthy)
profiles_server_dev  nodemon server.js     Up (healthy)
messages_server_dev  nodemon server.js     Up (healthy)
laboratory_server..  nodemon server.js     Up (healthy)
authentication_srv.. nodemon server.js     Up (healthy)
administration_srv.. nodemon server.js     Up (healthy)
```

### View Service Logs
```bash
# All services
docker compose -f compose.dev.yaml logs -f

# Specific service
docker compose -f compose.dev.yaml logs -f app_server

# Last 100 lines
docker compose -f compose.dev.yaml logs --tail=100 mongodb
```

### Check Service Health
```bash
# Get detailed status
docker inspect app_server_dev | jq '.State.Health'

# Test MongoDB connection
docker exec bucketlab_database_dev mongosh --eval "db.version()"

# Test app_server
curl http://localhost:4020/health
```

### Enter Service Container
```bash
# Interactive shell
docker exec -it app_server_dev /bin/sh

# Run commands
docker exec app_server_dev npm test
```

---

## Startup Performance Optimization

### Current Bottlenecks
1. **npm install** in each service (~15-20 seconds per service)
   - Happens every time with `--build` flag
   - Solution: Build images once, reuse them

2. **MongoDB initialization** (30-60 seconds)
   - Takes time on slow hardware
   - Solution: Increase start_period if running on Pi

3. **Nodemon startup** (5-10 seconds per service)
   - Watches directories before starting
   - Solution: Reduce number of watched directories

### Optimization Strategies

**Strategy 1: Pre-build Images**
```bash
# Build once
docker compose -f compose.dev.yaml build

# Start without rebuilding (faster)
docker compose -f compose.dev.yaml up
```

**Strategy 2: Parallel Builds**
```bash
# Already happens automatically
# Docker builds services in parallel when possible
```

**Strategy 3: Optimize Dockerfile**
```dockerfile
# Before: npm install every time
COPY . .
RUN npm install

# After: copy package.json only, then install, then copy code
COPY package*.json ./
RUN npm install
COPY . .
```

---

## Summary: Complete Startup Flow

```
docker compose -f compose.dev.yaml up --build --remove-orphans
    ↓
Read compose.dev.yaml + .env.dev
    ↓
Build Docker images (Node 22, MongoDB, etc)
    ↓
Create bucketLab_internal network
    ↓
Create volumes (mongodb_data_dev, avatars_data_dev)
    ↓
Start cloudflared tunnel
    ├─ Connects to Cloudflare network
    └─ Waits for service_started condition ✓
    ↓
Start MongoDB
    ├─ Initializes root user (empirical_explorer)
    ├─ Waits for healthcheck (db.version()) ✓
    └─ Waits 15 retries, 60s start period
    ↓
Start mongodb-init
    ├─ Connects with credentials
    ├─ Verifies db.adminCommand('ping')
    ├─ Exits with code 0
    └─ Waits for service_completed_successfully ✓
    ↓
Start 6 app services in parallel
    ├─ npm install dependencies
    ├─ Nodemon watches files
    ├─ Connects to MongoDB (retry logic)
    ├─ Listens on assigned ports
    └─ Wait for healthcheck passes ✓
    ↓
All services healthy and communicating
    ├─ External clients access via cloudflared tunnel
    ├─ Internal requests routed through app_server
    └─ All services connected to MongoDB
    ↓
✓ System Ready
```

**Total Startup Time:** 45-60 seconds (optimized)
**Total Startup Time:** 90-120 seconds (with fresh npm installs)

---

## Quick Reference: Service Ports & Purposes

| Service | Port | Purpose | Network |
|---------|------|---------|---------|
| cloudflared | N/A | Tunnel provider | host |
| MongoDB | 27017 | Database | internal |
| app_server | 4020 | API Gateway | exposed |
| profiles_server | 4021 | User profiles | internal |
| messages_server | 4022 | Messaging | internal |
| laboratory_server | 4023 | Experiments | internal |
| authentication_server | 4024 | Auth/JWT | internal |
| administration_server | 4025 | Admin panel | internal |

---

## Next Steps for Learning

1. **Examine individual Dockerfiles**
   - `docker/dev/Dockerfile.app`
   - `docker/dev/Dockerfile.mongodb`
   - `docker/dev/Dockerfile.profiles`

2. **Study service code**
   - `app/server.js` - Entry point for API gateway
   - `profiles/server.js` - Profiles service
   - `database_servers/*/server.js` - Each microservice

3. **Debug a service**
   - Stop it: `docker compose -f compose.dev.yaml stop app_server`
   - View logs: `docker compose -f compose.dev.yaml logs app_server`
   - Restart it: `docker compose -f compose.dev.yaml start app_server`

4. **Make changes and observe**
   - Edit a file in `./app/` or `./profiles/`
   - Watch nodemon reload the service
   - Check logs for changes taking effect

5. **Test inter-service communication**
   - Call API: `curl http://localhost:4020/health`
   - View logs: `docker compose logs -f`
   - Observe which services are contacted

