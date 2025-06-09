const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const { createPayrollPeriod, runPayroll, getPayslipSummary } = require('../controllers/adminController');
const authAdmin = require('../middleware/authAdmin');

router.post(
    '/payroll-period',
    authAdmin,
    [
        body('start_date').isISO8601().withMessage('Start date must be a valid date.'),
        body('end_date').isISO8601().withMessage('End date must be a valid date.')
    ],
    createPayrollPeriod
);

router.post('/run-payroll/:period_id', authAdmin, runPayroll);
router.get('/payslips/summary/:payroll_period_id', authAdmin, getPayslipSummary);

module.exports = router;

