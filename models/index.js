const { Sequelize } = require('sequelize');
const sequelize = require('../config/db');

// Import all models
const Employee = require('./employee');
const Admin = require('./admin');
const Attendance = require('./attendance');
const Overtime = require('./overtime');
const Reimbursement = require('./reimbursement');
const PayrollPeriod = require('./payrollPeriod');
const Payslip = require('./payslip');
const AuditLog = require('./auditLog');

// =======================
// Define Relationships
// =======================

// Attendance ↔ Employee ↔ PayrollPeriod
Employee.hasMany(Attendance, { foreignKey: 'employee_id' });
Attendance.belongsTo(Employee, { foreignKey: 'employee_id' });

PayrollPeriod.hasMany(Attendance, { foreignKey: 'payroll_period_id' });
Attendance.belongsTo(PayrollPeriod, { foreignKey: 'payroll_period_id' });

// Overtime ↔ Employee ↔ PayrollPeriod
Employee.hasMany(Overtime, { foreignKey: 'employee_id' });
Overtime.belongsTo(Employee, { foreignKey: 'employee_id' });

PayrollPeriod.hasMany(Overtime, { foreignKey: 'payroll_period_id' });
Overtime.belongsTo(PayrollPeriod, { foreignKey: 'payroll_period_id' });

// Reimbursement ↔ Employee ↔ PayrollPeriod
Employee.hasMany(Reimbursement, { foreignKey: 'employee_id' });
Reimbursement.belongsTo(Employee, { foreignKey: 'employee_id' });

PayrollPeriod.hasMany(Reimbursement, { foreignKey: 'payroll_period_id' });
Reimbursement.belongsTo(PayrollPeriod, { foreignKey: 'payroll_period_id' });

// Payslip ↔ Employee ↔ PayrollPeriod
Employee.hasMany(Payslip, { foreignKey: 'employee_id' });
Payslip.belongsTo(Employee, { foreignKey: 'employee_id' });

PayrollPeriod.hasMany(Payslip, { foreignKey: 'payroll_period_id' });
Payslip.belongsTo(PayrollPeriod, { foreignKey: 'payroll_period_id' });

// AuditLog doesn't have strict foreign keys (loose coupling)
Employee.hasMany(AuditLog, { foreignKey: 'user_id', constraints: false, scope: { user_role: 'employee' } });
Admin.hasMany(AuditLog, { foreignKey: 'user_id', constraints: false, scope: { user_role: 'admin' } });

// =======================
// Export Models
// =======================
module.exports = {
  sequelize,
  Sequelize,
  Employee,
  Admin,
  Attendance,
  Overtime,
  Reimbursement,
  PayrollPeriod,
  Payslip,
  AuditLog
};
