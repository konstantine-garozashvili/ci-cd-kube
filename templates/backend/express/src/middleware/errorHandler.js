const config = require('../config');

// Standardized 404 Handler
function notFoundHandler(req, res, _next) {
  res.status(404).json({
    status: 404,
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.originalUrl}`,
    timestamp: new Date().toISOString(),
  });
}

// Global Exception & Error Handler
function errorHandler(err, _req, res, _next) {
  const statusCode = err.status || err.statusCode || 500;
  const isDev = config.env === 'development' || config.env === 'test';

  const response = {
    status: statusCode,
    error: err.name || 'Internal Server Error',
    message: err.message || 'An unexpected error occurred',
    timestamp: new Date().toISOString(),
  };

  if (isDev && err.stack) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
}

module.exports = {
  notFoundHandler,
  errorHandler,
};
