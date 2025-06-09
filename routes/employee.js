const express = require('express');
const {
  submitAttendance,
  submitOvertime,
  submitReimbursement,
  generatePayslip
} = require('../controllers/employeeController');

const router = express.Router();
const authEmployee = require('../middleware/authEmployee');

router.post('/attendance', authEmployee, submitAttendance);
router.post('/overtime', authEmployee, submitOvertime);
router.post('/reimbursement', authEmployee, submitReimbursement);
router.post('/generate-payslip', authEmployee, generatePayslip);

module.exports = router;
