# Copilot Instructions for BucketLab API

## Project Overview

- **BucketLab API** is a backend service for the BucketLab application, providing RESTful endpoints for user management, storage, and inter-user communication.
- Designed for deployment on ARM64 devices (e.g., Raspberry Pi 5) using Docker containers.
- Main entry points: `accounts/server.js` and `app/server.js`.

## Architecture & Structure

- **Monorepo** with multiple services:
  - `accounts/`: Authentication and user management (Node.js, Express)
  - `app/`: Main application logic (Node.js, Express)
  - `data/`: MongoDB data files (do not modify directly)
  - `mongodb/`: MongoDB configuration
- **Service boundaries**: Each service has its own `package.json`, tests, and source code.
- **API versioning**: Use `src/v1/` for current endpoints.

## Developer Workflows

- **Install dependencies**: Run `npm install` in each service directory (`accounts/`, `app/`).
- **Run tests**: Use `npm test` in the respective service directory. Tests are organized in `__tests__/` and use Jest.
- **Start services (local/dev)**:
  - `docker compose --env-file .env.dev -f compose.dev.yaml up --build`
- **Start services (production)**:
  - `docker compose --env-file .env -f compose.production.yaml up --build`
- **Stop services**:
  - `docker compose --env-file .env.dev -f compose.dev.yaml down`

## Conventions & Patterns

- **Controllers**: Route handlers are in `src/v1/` and tested in `__tests__/controllers/`.
- **Environment variables**: Required in a `.env` file at the repo root. Reference `README.md` for details.
- **Testing**: Use `setup.js` for test environment setup. Common utilities in `testUtils.js`.
- **API access**: Default port is `4020`. External access via Cloudflare Tunnel (see `README.md`).

## Integration Points

- **MongoDB**: Data files in `data/`, config in `mongodb/mongod.conf`. Do not edit data files directly.
- **Docker**: All services run in containers. Use provided Dockerfiles and compose files.
- **Cloudflare Tunnel**: For remote API access, configure domain as described in `README.md`.

## Examples

- To add a new endpoint, create a controller in `src/v1/`, add tests in `__tests__/controllers/`, and update routing in `server.js`.
- To run all tests for authentication, use `npm test` in `accounts/`.

## Key Files & Directories

- `accounts/server.js`, `app/server.js`: Service entry points
- `accounts/__tests__/`, `app/__tests__/`: Test suites
- `compose.dev.yaml`, `compose.production.yaml`: Docker Compose configs
- `README.md`: Setup, environment, and deployment instructions

---

For questions or unclear conventions, review the relevant README files or ask for clarification.
