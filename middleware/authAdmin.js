// middleware/authEmployee.js
const jwt = require('jsonwebtoken');
const { Admin } = require('../models');

module.exports = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized Admin: Missing token' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const admin = await Admin.findByPk(decoded.id);

    if (!admin) {
      return res.status(401).json({ error: 'Unauthorized Admin: Invalid admin' });
    }

    req.user = { id: admin.id, username: admin.username };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized Admin: Invalid token' });
  }
};
