const express = require('express');
const app = express();
const cors = require('cors');
const laboratoryRouter = require('./routes/laboratoryRouter.js');
const homelabRouter = require('./routes/homelabRouter.js');
const { corsConfig } = require('./optimization/corsConfig.js');

app.set('trust proxy', true);

app.use(cors(corsConfig()));
app.use(express.json());

app.use('/', (req, res, next) => {
  req.requestTime = new Date().toISOString();
  console.log(`Request received at Laboratory_Server @ ${req.requestTime} for ${req.originalUrl}`);
  console.log(`Request method: ${req.method}, path: ${req.path}, params:`, req.params);
  next();
});

app.use('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'BucketLab Laboratory Server is healthy and operational.'
  });
});

app.use('/', laboratoryRouter);``
app.use('/homelab', homelabRouter);

app.all('/*', (req, res) => {
  res.status(404).json({
    status: 'fail',
    fail_type: 'server_error',
    message: `Can't find ${req.originalUrl} on this server!`
  })
});

module.exports = app;