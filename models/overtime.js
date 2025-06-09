const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

/**
 * Overtime model tracks extra hours worked beyond regular schedule.
 * Rules:
 * - Must be submitted *after* work (handled at controller)
 * - Max 3 hours per day (validated in logic)
 */
const Overtime = sequelize.define('Overtime', {
  employee_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'FK to Employee'
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    comment: 'Date of the overtime work'
  },
  hours: {
    type: DataTypes.DECIMAL(4, 2),
    allowNull: false,
    comment: 'Total hours claimed (max 3.00)'
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
  tableName: 'overtimes',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['employee_id', 'date']
    }
  ]
});

module.exports = Overtime;
