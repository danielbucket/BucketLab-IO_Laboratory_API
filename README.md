# BucketLab API

BucketLab API is a backend service designed to manage and process data for the BucketLab application. It provides a set of RESTful endpoints to handle various operations such as user management and storage, inter-user communications.
This api can be deployed on virtually any arm64 computer with an installed Docker deamon.
It was built on a macBook, but it is live-served from an active Raspberry Pi5 deployment that houses a containerized instance of the BucketLab Empire.
Baby steps. One empirical baby-step at a time.

## Features
- User authentication and authorization
- Data encryption and tokenization
- Data management and processing
- Analytics and reporting

## Prerequisites
Ensure you have the following installed on your system:
- [Node.js](https://nodejs.org/) (v14 or higher)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)
- [Docker](https://www.docker.com/)

## Getting Started

Follow these steps to set up and run the application locally:

### 1. Clone the Repository
```bash
git clone https://git@github.com:danielbucket/BucketLab_api.git
cd BucketLab_api
```

### 2. Install Dependencies
Using npm:
```bash
npm install
```
Or using yarn:
```bash
yarn install
```

### 3. Configure Environment Variables

#### For Development:
Create a `.env.dev` file in the root directory and add the required environment variables:
```
MONGO_DB_PASSWORD=your_password_for_mongoDB
MONGO_DB_USERNAME=your_username_for_mongoDB
MONGO_DB_DATABASE=bucketlab
TUNNEL_TOKEN=your_cloudflared_tunnel_token
JWT_SECRET=your_development_secret_key
JWT_EXPIRES_IN=7d
```

#### For Production:
Create a `.env` file in the root directory and add the required environment variables:
```
MONGO_DB_PASSWORD=your_production_password_for_mongoDB
MONGO_DB_USERNAME=your_production_username_for_mongoDB
MONGO_DB_DATABASE=bucketlab
TUNNEL_TOKEN=your_production_cloudflared_tunnel_token
JWT_SECRET=your_production_secret_key
JWT_EXPIRES_IN=24h
APP_RUN_MODE=production
```

### 4. Start the Application

#### Development:
```bash
docker compose -f compose.dev.yaml up --build -d
```

#### Production:
```bash
sudo docker compose --project-name bucketlab-prod --env-file .env -f compose.production.yaml up -d --build
```

### To Stop the Application:
```bash
# Development
docker compose -f compose.dev.yaml down

# Production
sudo docker compose --project-name bucketlab-prod --env-file .env -f compose.production.yaml down --remove-orphans
```

## Development:
```bash
docker compose -f compose.dev.yaml up --build -d
```

### 5. Access the API
Once the app is running, you can access the API at `http://localhost:4020`.
Or by navigating to the domain that the Cloudflare Tunnel is connected to.
Example: `https://api.bucketlab.io/`

## Running Tests
To run the test suite:
```bash
npm test
```

## Contributing
Contributions are welcome! Please submit a pull request or open an issue for any suggestions or improvements. 

## License
This project is licensed under the [MIT License](LICENSE).
