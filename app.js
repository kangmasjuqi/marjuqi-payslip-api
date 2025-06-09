// app.js
require('dotenv').config();

const express = require('express');
const morgan = require('morgan');
const { v4: uuidv4 } = require('uuid');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');

const app = express();
const ENV = process.env.NODE_ENV || 'development';

// Global Middleware
app.use(express.json());
app.use(morgan('dev'));
app.use(helmet());
app.use(cors());

// Request Trace ID Middleware
app.use((req, res, next) => {
  const traceId = req.headers['x-request-id'] || uuidv4();
  req.requestId = traceId;
  req.ipAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

  res.setHeader('X-Request-Id', traceId);
  next();
});

// Routes
app.use('/api/admin', require('./routes/admin'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/employees', require('./routes/employee'));
app.use('/pdf', express.static(path.join(__dirname, 'pdf')));

// Health Check
app.get('/', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Payslip API is running',
    env: ENV,
    requestId: req.requestId,
    ip: req.ipAddress,
    timestamp: new Date().toISOString()
  });
});

module.exports = app;
