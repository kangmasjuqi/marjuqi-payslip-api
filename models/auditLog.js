const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

/**
 * AuditLog stores significant activity across the system for security and traceability.
 */
const AuditLog = sequelize.define('AuditLog', {
  user_id: {
    type: DataTypes.INTEGER,
    comment: 'User who performed the action'
  },
  user_role: {
    type: DataTypes.ENUM('employee', 'admin'),
    allowNull: false
  },
  action: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'e.g. CREATE_ATTENDANCE, SUBMIT_OVERTIME'
  },
  table_name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  record_id: {
    type: DataTypes.INTEGER,
    comment: 'Affected record ID'
  },
  ip_address: {
    type: DataTypes.STRING
  },
  request_id: {
    type: DataTypes.STRING,
    allowNull: false
  },
  details: {
    type: DataTypes.JSONB,
    comment: 'Any extra context to trace this log'
  }
}, {
  tableName: 'audit_logs',
  timestamps: true
});

module.exports = AuditLog;
