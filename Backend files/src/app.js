const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const { errorHandler, notFound } = require('./middleware/errorHandler');

const app = express();

app.use(cors()); 
// Increase body size limit to handle large CSV imports (50MB)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' })); 

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'prontolog-api' }));

// All API routes
app.use('/api', routes);

//admin routes
app.use("/api/admin", require("./routes/adminRoutes"));

// 404 + central error handling (must be last)
app.use(notFound);
app.use(errorHandler);

module.exports = app;