// models/attendance.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

/**
 * Attendance model logs when an employee checks in on a given workday.
 * Rules:
 * - Only 1 record per employee per day
 * - No attendance on weekends
 */
const Attendance = sequelize.define('Attendance', {
  employee_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'FK to Employee'
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    comment: 'Date of attendance (YYYY-MM-DD)'
  },
  payroll_period_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'FK to PayrollPeriod'
  },
  created_by: { type: DataTypes.STRING },
  updated_by: { type: DataTypes.STRING },
  ip_address: { type: DataTypes.STRING }
}, {
  tableName: 'attendances',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['employee_id', 'date']
    }
  ]
});

module.exports = Attendance;
