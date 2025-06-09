const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

/**
 * Employee model represents a regular employee who can:
 * - Submit attendance
 * - Submit overtime and reimbursements
 * - Generate payslips
 *
 * Includes audit fields for traceability and compliance.
 */
const Employee = sequelize.define('Employee', {
  fullname: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Employee fullname'
  },
  username: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false,
    comment: 'Unique employee username'
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Hashed password'
  },
  salary: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    comment: 'Monthly base salary'
  },
  created_by: {
    type: DataTypes.STRING,
    comment: 'Who created this record'
  },
  updated_by: {
    type: DataTypes.STRING,
    comment: 'Who last updated this record'
  },
  ip_address: {
    type: DataTypes.STRING,
    comment: 'Request origin IP address'
  }
}, {
  tableName: 'employees',
  timestamps: true
});

module.exports = Employee;
