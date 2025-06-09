const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

/**
 * Reimbursement model allows employees to claim expenses.
 * Rules:
 * - Amount is required
 * - Description is optional but recommended
 */
const Reimbursement = sequelize.define('Reimbursement', {
  employee_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'FK to Employee'
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    comment: 'Date of expense'
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    comment: 'Amount requested for reimbursement'
  },
  description: {
    type: DataTypes.TEXT,
    comment: 'Optional explanation of the expense'
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
  tableName: 'reimbursements',
  timestamps: true
});

module.exports = Reimbursement;
