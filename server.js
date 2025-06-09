require('dotenv').config();

const express = require('express');
const morgan = require('morgan');
const { v4: uuidv4 } = require('uuid');
const helmet = require('helmet');
const cors = require('cors');
const { sequelize } = require('./models');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const ENV = process.env.NODE_ENV || 'development';

// --- Validate required ENV ---
if (!process.env.JWT_SECRET) {
  console.error('❌ Missing required env: JWT_SECRET');
  process.exit(1);
}

// --- Global Middleware ---
app.use(express.json());
app.use(morgan('dev'));
app.use(helmet());
app.use(cors());

// --- Request Trace ID Middleware ---
app.use((req, res, next) => {
  const traceId = req.headers['x-request-id'] || uuidv4();
  req.requestId = traceId;
  req.ipAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

  // For logs and traceable response headers
  res.setHeader('X-Request-Id', traceId);
  next();
});

// --- Routes ---
app.use('/api/admin', require('./routes/admin'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/employees', require('./routes/employee'));
app.use('/pdf', express.static(path.join(__dirname, 'pdf')));


// --- Health Check ---
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

// --- Start Server ---
sequelize.authenticate()
  .then(() => {
    console.log('✅ Database connected.');
    app.listen(PORT, () => {
      console.log(`🚀 Server running at http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ Database connection failed:', err.message);
    process.exit(1);
  });
