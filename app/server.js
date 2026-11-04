const app = require('./src/v1/app.js');
const PORT = process.env.PORT || 4020;

const server = app.listen(PORT, () => {
  console.log(`BucketLab API Server is running on port: ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});