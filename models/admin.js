const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

/**
 * Admin represents administrative users of the system.
 * This model can be extended for RBAC if needed later.
 */
const Admin = sequelize.define('Admin', {
  username: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  created_by: { type: DataTypes.STRING },
  updated_by: { type: DataTypes.STRING },
  ip_address: { type: DataTypes.STRING }
}, {
  timestamps: true,
  tableName: 'admins'
});

module.exports = Admin;
