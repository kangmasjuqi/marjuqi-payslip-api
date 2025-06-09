// server.js
const { sequelize } = require('./models');
const app = require('./app');
const PORT = process.env.PORT || 3000;

if (!process.env.JWT_SECRET) {
  console.error('❌ Missing required env: JWT_SECRET');
  process.exit(1);
}

sequelize.authenticate()
  .then(() => {
    console.log('✅ Database connected to:', sequelize.config.database);
    app.listen(PORT, () => {
      console.log(`🚀 Server running at http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ Database connection failed:', err.message);
    process.exit(1);
  });
