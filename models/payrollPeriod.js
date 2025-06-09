const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

/**
 * PayrollPeriod defines the period for which payroll is calculated.
 * - Each employee submission (attendance/overtime/reimbursement) is linked to one period.
 * - Payroll can only be run once per period.
 */
const PayrollPeriod = sequelize.define('PayrollPeriod', {
  start_date: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  end_date: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  is_processed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Once true, the data is locked for payroll generation'
  },
  created_by: { type: DataTypes.STRING },
  updated_by: { type: DataTypes.STRING },
  ip_address: { type: DataTypes.STRING }
}, {
  tableName: 'payroll_periods',
  timestamps: true
});

module.exports = PayrollPeriod;
