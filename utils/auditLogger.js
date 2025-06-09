// utils/auditLogger.js
const AuditLog = require('../models/AuditLog'); // Adjust the path as needed

/**
 * Logs an audit event to the database.
 * @param {object} options - The options for the audit log.
 * @param {number} options.userId - The ID of the user who performed the action.
 * @param {string} options.userRole - The role of the user ('employee' or 'admin').
 * @param {string} options.action - The action performed (e.g., 'CREATE_ATTENDANCE', 'UPDATE_USER').
 * @param {string} options.tableName - The name of the table affected.
 * @param {number} [options.recordId] - The ID of the specific record affected (optional).
 * @param {string} options.ipAddress - The IP address of the request.
 * @param {string} options.requestId - The unique request ID for tracing.
 * @param {object} [options.details] - Any additional JSON details for the log (optional).
 */
async function logAuditEvent({
  userId,
  userRole,
  action,
  tableName,
  recordId,
  ipAddress,
  requestId,
  details
}) {
  try {
    await AuditLog.create({
      user_id: userId,
      user_role: userRole,
      action: action,
      table_name: tableName,
      record_id: recordId,
      ip_address: ipAddress,
      request_id: requestId,
      details: details,
    });
    console.log(`Audit log created for action: ${action} on ${tableName}`);
  } catch (error) {
    console.error('Failed to create audit log:', error);
    // Depending on your application, you might want to throw the error
    // or handle it more gracefully (e.g., send to a separate error logging service).
  }
}

module.exports = logAuditEvent;