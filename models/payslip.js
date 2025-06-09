const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

/**
 * Payslip stores the locked salary computation for an employee for a given payroll period.
 * - Based on attendance, overtime, and reimbursements.
 * - Contains take-home pay & breakdown.
 */
const Payslip = sequelize.define('Payslip', {
  employee_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'FK to Employee'
  },
  payroll_period_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'FK to PayrollPeriod'
  },
  base_salary: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  attendance_days: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  overtime_hours: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false
  },
  overtime_pay: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  reimbursements: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  total_pay: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false
  },
  created_by: { type: DataTypes.STRING },
  updated_by: { type: DataTypes.STRING },
  ip_address: { type: DataTypes.STRING }
}, {
  tableName: 'payslips',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['employee_id', 'payroll_period_id']
    }
  ]
});

module.exports = Payslip;
