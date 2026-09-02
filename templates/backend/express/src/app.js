const express = require('express');
const config = require('./config');
const path = require('path');
const { securityHeaders, corsMiddleware, limiter } = require('./middleware/security');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const healthRoutes = require('./routes/health.routes');
const apiRoutes = require('./routes/api.routes');

const app = express();

// 0. Proxy awareness. Set before the rate limiter so it derives client IPs
// from the correct hop instead of rejecting the request outright.
app.set('trust proxy', config.trustProxy);

// 1. Security & Core Middleware
app.use(securityHeaders);
app.use(corsMiddleware);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// 2. Static Assets (Landing Page)
app.use(express.static(path.join(__dirname, 'public')));

// 3. Health Routes (Excluded from rate limiter for probe reliability)
app.use('/', healthRoutes);

// 4. Rate Limiting for API routes
app.use('/api', limiter);

// 5. API Routes
app.use('/api', apiRoutes);

// 6. 404 & Global Error Handling
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
