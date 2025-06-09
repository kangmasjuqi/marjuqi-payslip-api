const { PayrollPeriod, Employee, Attendance, Overtime, Reimbursement, Payslip } = require('../models');
const { validationResult } = require('express-validator');
const { Op, Sequelize } = require('sequelize');
const { safeNumber, countWorkingDays } = require('../utils/helpers');

/**
 * Admin defines a new payroll period.
 * Prevents overlapping periods and ensures only one payroll per period.
 */
exports.createPayrollPeriod = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { start_date, end_date } = req.body;
  const ip = req.ip;
  const adminUsername = req.user?.username || 'admin';

  try {
    if (new Date(start_date) > new Date(end_date)) {
      return res.status(400).json({ message: '❌ Start date must be before end date.' });
    }

    // Prevent overlap with existing periods
    const exists = await PayrollPeriod.findOne({
      where: {
        start_date: { [Op.lte]: end_date },
        end_date: { [Op.gte]: start_date }
      }
    });

    if (exists) {
      return res.status(409).json({ message: '❌ Period overlaps with an existing payroll period.' });
    }

    const period = await PayrollPeriod.create({
      start_date,
      end_date,
      is_processed: false,
      created_by: adminUsername,
      updated_by: adminUsername,
      ip_address: ip
    });

    res.status(201).json({
      message: '✅ Payroll period created successfully.',
      data: period
    });
  } catch (err) {
    console.error('[PayrollPeriod:create]', err);
    res.status(500).json({ message: '❌ Internal server error.' });
  }
};

/**
 * Admin runs payroll for a period.
 * - Locks the period (is_processed = true).
 * - Computes base salary, overtime pay, reimbursements.
 * - Stores total pay in payslip.
 * - Cannot rerun for already processed period.
 */
exports.runPayroll = async (req, res) => {
  const { period_id } = req.params;
  const ip = req.ip;
  const adminUsername = req.user?.username || 'admin';

  try {
    const period = await PayrollPeriod.findByPk(period_id);
    if (!period) return res.status(404).json({ message: '❌ Payroll period not found.' });

    if (period.is_processed) {
      return res.status(400).json({ message: '❌ Payroll already processed for this period.' });
    }

    // Get all employees
    const employees = await Employee.findAll();

    const payslipData = [];

    for (const emp of employees) {
      const employeeId = emp.id;
      const baseSalary = parseFloat(emp.salary);

      // Attendance
      const attendanceCount = await Attendance.count({
        where: {
          employee_id: employeeId,
          date: {
            [Op.between]: [period.start_date, period.end_date]
          }
        }
      });

      // Overtime
      const overtimeRecords = await Overtime.findAll({
        where: {
          employee_id: employeeId,
          date: {
            [Op.between]: [period.start_date, period.end_date]
          }
        }
      });

      const workingHours = attendanceCount * 8;  // parseFloat(process.env.WORKING_HOURS_PER_MONTH || '160');
      const otMultiplier = parseFloat(process.env.OVERTIME_MULTIPLIER || '2');

      const totalOvertimeHours = overtimeRecords.reduce((sum, ot) => sum + parseFloat(ot.hours), 0);
      const hourlyRate = baseSalary / workingHours;
      const overtimePay = totalOvertimeHours * hourlyRate * otMultiplier;

      // Reimbursements
      const totalReimbursements = await Reimbursement.sum('amount', {
        where: {
          employee_id: employeeId,
          date: {
            [Op.between]: [period.start_date, period.end_date]
          }
        }
      });

        // Their take-home pay will be prorated based on their attendance vs working days in month
        const workingDays = countWorkingDays(period.start_date, period.end_date);
        const attendanceFactor = attendanceCount / workingDays;
        const proratedBaseSalary = baseSalary * attendanceFactor;
        
        const totalPay =
            safeNumber(proratedBaseSalary) +
            safeNumber(overtimePay) +
            safeNumber(totalReimbursements);
        
      payslipData.push({
        employee_id: employeeId,
        payroll_period_id: period.id,
        base_salary: proratedBaseSalary.toFixed(2),
        attendance_days: attendanceCount,
        overtime_hours: totalOvertimeHours.toFixed(2),
        overtime_pay: overtimePay.toFixed(2),
        reimbursements: (totalReimbursements || 0).toFixed(2),
        total_pay: totalPay.toFixed(2),
        created_by: adminUsername,
        updated_by: adminUsername,
        ip_address: ip
      });
    }

    // Bulk insert all payslips
    await Payslip.bulkCreate(payslipData);

    // Mark period as processed
    period.is_processed = true;
    period.updated_by = adminUsername;
    period.ip_address = ip;
    await period.save();

    res.status(200).json({
      message: '✅ Payroll processed successfully.',
      summary: {
        processed_employees: payslipData.length,
        period: { id: period.id, start: period.start_date, end: period.end_date }
      }
    });
  } catch (err) {
    console.error('[Payroll:run]', err);
    res.status(500).json({ message: '❌ Internal server error.' });
  }
};

exports.getPayslipSummary = async (req, res) => {
  const { payroll_period_id } = req.params;

  try {
    // Check payroll period existence
    const period = await PayrollPeriod.findByPk(payroll_period_id);
    if (!period) return res.status(404).json({ message: '❌ Payroll period not found.' });

    // Get payslips with employee info
    const payslips = await Payslip.findAll({
      where: { payroll_period_id },
      include: [{ model: Employee, attributes: ['id'] }],
      order: [['employee_id', 'ASC']]
    });

    if (payslips.length === 0) {
      return res.status(404).json({ message: '⚠️ No payslips found for this period.' });
    }

    const summary = payslips.map(p => ({
      employee_id: p.employee_id,
      total_pay: parseFloat(p.total_pay)
    }));

    const total_take_home = summary.reduce((sum, e) => sum + e.total_pay, 0);

    return res.json({
      period: `${period.start_date} to ${period.end_date}`,
      summary,
      total_take_home: total_take_home.toFixed(2)
    });

  } catch (err) {
    console.error('[getPayslipSummary]', err);
    res.status(500).json({ message: '❌ Internal server error.' });
  }
};
