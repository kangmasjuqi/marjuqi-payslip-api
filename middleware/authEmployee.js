// middleware/authEmployee.js
const jwt = require('jsonwebtoken');
const { Employee } = require('../models');

module.exports = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const employee = await Employee.findByPk(decoded.id);

    if (!employee) {
      return res.status(401).json({ error: 'Unauthorized: Invalid employee' });
    }

    req.user = { id: employee.id, username: employee.username };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};
