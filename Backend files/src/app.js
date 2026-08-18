const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const { errorHandler, notFound } = require('./middleware/errorHandler');

const app = express();

app.use(cors()); // frontend will call from a different origin/port
app.use(express.json()); // parse JSON bodies

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'prontolog-api' }));

// All API routes
app.use('/api', routes);

// 404 + central error handling (must be last)
app.use(notFound);
app.use(errorHandler);

module.exports = app;