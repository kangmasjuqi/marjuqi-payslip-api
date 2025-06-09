const { Employee, Attendance, Overtime, Reimbursement, Payslip, PayrollPeriod } = require('../models');
const { Op } = require('sequelize');
const moment = require('moment');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const { safeNumber, countWorkingDays } = require('../utils/helpers');

/**
 * Get list of all employees (exclude password field).
 */
exports.getAllEmployees = async (req, res) => {
  try {
    const employees = await Employee.findAll({
      attributes: { exclude: ['password'] }
    });
    res.json(employees);
  } catch (error) {
    console.error('getAllEmployees error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

/**
 * Employee submits attendance for today.
 * Rules:
 * - No attendance on weekends.
 * - Only one attendance per employee per day.
 * - Must be within an active payroll period.
 */
exports.submitAttendance = async (req, res) => {
  try {
    const employeeId = req.user.id; // Provided by auth middleware
    const ipAddress = req.ip;
    const today = moment().startOf('day');

    // Check for weekend (Saturday=6 or Sunday=7)
    const dayOfWeek = today.isoWeekday();
    if (dayOfWeek === 6 || dayOfWeek === 7) {
      return res.status(400).json({ error: 'Attendance submission is not allowed on weekends.' });
    }

    // Find active payroll period including today
    const payrollPeriod = await PayrollPeriod.findOne({
      where: {
        start_date: { [Op.lte]: today.format('YYYY-MM-DD') },
        end_date: { [Op.gte]: today.format('YYYY-MM-DD') },
        is_processed: false
      }
    });

    if (!payrollPeriod) {
      return res.status(400).json({ error: 'No active payroll period found for today.' });
    }

    // Check if attendance already exists for today
    const existingAttendance = await Attendance.findOne({
      where: {
        employee_id: employeeId,
        date: today.format('YYYY-MM-DD')
      }
    });

    if (existingAttendance) {
      return res.status(200).json({ message: 'Attendance already submitted for today.' });
    }

    // Create attendance record
    await Attendance.create({
      employee_id: employeeId,
      date: today.format('YYYY-MM-DD'),
      payroll_period_id: payrollPeriod.id,
      created_by: employeeId.toString(),
      updated_by: employeeId.toString(),
      ip_address: ipAddress
    });

    return res.status(201).json({ message: 'Attendance submitted successfully.' });
  } catch (error) {
    console.error('submitAttendance error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

/**
 * Employee submits overtime.
 * Rules:
 * - Must be submitted after work (same day or next day, but not future date).
 * - Max 3 hours per day.
 * - Only one overtime entry per day.
 * - Must fall within active payroll period.
 */
exports.submitOvertime = async (req, res) => {
  try {
    const employeeId = req.user.id;
    const ipAddress = req.ip;
    const { date, hours } = req.body;

    // Validate input
    if (!date || !hours) {
      return res.status(400).json({ error: 'Date and hours are required.' });
    }

    const submittedDate = moment(date, 'YYYY-MM-DD', true);
    if (!submittedDate.isValid()) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
    }

    if (submittedDate.isAfter(moment(), 'day')) {
      return res.status(400).json({ error: 'Cannot submit overtime for future dates.' });
    }

    if (parseFloat(hours) > 3.0) {
      return res.status(400).json({ error: 'Overtime cannot exceed 3 hours per day.' });
    }

    // Find active payroll period
    const payrollPeriod = await PayrollPeriod.findOne({
      where: {
        start_date: { [Op.lte]: submittedDate.format('YYYY-MM-DD') },
        end_date: { [Op.gte]: submittedDate.format('YYYY-MM-DD') },
        is_processed: false
      }
    });

    if (!payrollPeriod) {
      return res.status(400).json({ error: 'No active payroll period for the given date.' });
    }

    // Check if already submitted
    const existing = await Overtime.findOne({
      where: {
        employee_id: employeeId,
        date: submittedDate.format('YYYY-MM-DD')
      }
    });

    if (existing) {
      return res.status(409).json({ error: 'Overtime already submitted for this date.' });
    }

    // Create overtime entry
    await Overtime.create({
      employee_id: employeeId,
      date: submittedDate.format('YYYY-MM-DD'),
      hours: parseFloat(hours),
      payroll_period_id: payrollPeriod.id,
      created_by: employeeId.toString(),
      updated_by: employeeId.toString(),
      ip_address: ipAddress
    });

    return res.status(201).json({ message: 'Overtime submitted successfully.' });
  } catch (error) {
    console.error('submitOvertime error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

/**
 * Employee submits reimbursement claim.
 * Rules:
 * - Amount is required and must be positive.
 * - Description is optional but recommended.
 * - Date defaults to today if not provided.
 * - Must fall within an active payroll period.
 */
exports.submitReimbursement = async (req, res) => {
  try {
    const employeeId = req.user.id;
    const ipAddress = req.ip;
    const { amount, description, date } = req.body;

    // Validate amount
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'Valid positive amount is required.' });
    }

    // Validate date or default to today
    const expenseDate = date ? moment(date, 'YYYY-MM-DD', true) : moment();
    if (!expenseDate.isValid()) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
    }

    // Find active payroll period for the date
    const payrollPeriod = await PayrollPeriod.findOne({
      where: {
        start_date: { [Op.lte]: expenseDate.format('YYYY-MM-DD') },
        end_date: { [Op.gte]: expenseDate.format('YYYY-MM-DD') },
        is_processed: false
      }
    });

    if (!payrollPeriod) {
      return res.status(400).json({ error: 'No active payroll period found for the expense date.' });
    }

    // Create reimbursement record
    await Reimbursement.create({
      employee_id: employeeId,
      date: expenseDate.format('YYYY-MM-DD'),
      amount: parseFloat(amount).toFixed(2),
      description: description || null,
      payroll_period_id: payrollPeriod.id,
      created_by: employeeId.toString(),
      updated_by: employeeId.toString(),
      ip_address: ipAddress
    });

    return res.status(201).json({ message: 'Reimbursement submitted successfully.' });
  } catch (error) {
    console.error('submitReimbursement error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};


exports.generatePayslip = async (req, res) => {
  const { payroll_period_id } = req.body;
  const ip = req.ip;
  const employeeId = req.user.id;
  const username = req.user.username;

  try {
    const period = await PayrollPeriod.findByPk(payroll_period_id);
    if (!period) return res.status(404).json({ message: '❌ Payroll period not found.' });

    const existing = await Payslip.findOne({
      where: { employee_id: employeeId, payroll_period_id }
    });
    if (existing) return res.status(400).json({ message: '❌ Payslip already generated.' });

    const emp = await Employee.findByPk(employeeId);
    const baseSalary = parseFloat(emp.salary);

    const attendanceDays = await Attendance.count({
      where: {
        employee_id: employeeId,
        date: { [Op.between]: [period.start_date, period.end_date] }
      }
    });

    const overtimeRecords = await Overtime.findAll({
      where: {
        employee_id: employeeId,
        date: { [Op.between]: [period.start_date, period.end_date] }
      }
    });

    const workingHours = attendanceDays * 8;  // parseFloat(process.env.WORKING_HOURS_PER_MONTH || '160');
    const otMultiplier = parseFloat(process.env.OVERTIME_MULTIPLIER || '2');
    const hourlyRate = baseSalary / workingHours;

    const totalOT = overtimeRecords.reduce((sum, ot) => sum + parseFloat(ot.hours), 0);
    const overtimePay = totalOT * hourlyRate * otMultiplier;

    const reimbursementTotal = await Reimbursement.sum('amount', {
      where: {
        employee_id: employeeId,
        date: { [Op.between]: [period.start_date, period.end_date] }
      }
    });

    // Their take-home pay will be prorated based on their attendance vs working days in month
    const workingDays = countWorkingDays(period.start_date, period.end_date);
    const attendanceFactor = attendanceDays / workingDays;
    const proratedBaseSalary = baseSalary * attendanceFactor;
    
    const totalPay =
        safeNumber(proratedBaseSalary) +
        safeNumber(overtimePay) +
        safeNumber(reimbursementTotal);

    const payslip = {
      employee_id: employeeId,
      payroll_period_id,
      base_salary: proratedBaseSalary.toFixed(2),
      attendance_days: attendanceDays,
      overtime_hours: totalOT.toFixed(2),
      overtime_pay: overtimePay.toFixed(2),
      reimbursements: (reimbursementTotal || 0).toFixed(2),
      total_pay: totalPay.toFixed(2),
      created_by: username,
      updated_by: username,
      ip_address: ip
    };

    // store to DB 
    // await Payslip.create(payslip);

    // PDF generation
    const doc = new PDFDocument({ margin: 50 });
    const filePath = path.join(__dirname, `../pdf/payslip_${employeeId}_${payroll_period_id}.pdf`);
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // Header
    doc.fontSize(18).text('PAYSLIP', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Employee ID/Username   : #${emp.id} / ${emp.username}`);
    doc.text(`Payroll Period  : ${period.start_date} to ${period.end_date}`);
    doc.text(`Generated At    : ${moment().format('YYYY-MM-DD HH:mm:ss')}`);
    doc.moveDown(1.5);

    // Simulated HTML-Style Table
    const currency = (val) => `USD ${parseFloat(val).toFixed(2)}`;

    // Optional helper for aligning text (monospaced look)
    const pad = (text, length) => text.padEnd(length, ' ');

    doc.font('Courier').fontSize(10);

    doc.text('----------------------------------------------------------------------------');
    doc.text(`${pad('Section', 22)} | ${pad('Detail', 35)} | Amount`);
    doc.text('----------------------------------------------------------------------------');

    doc.text(`${pad('Salary', 22)} | ${pad('* Base Salary (bs)', 35)} | ${currency(baseSalary)}`);
    doc.text(`${pad('', 22)} | ${pad('* Working Days (wd)', 35)} | ${workingDays}`);
    doc.text(`${pad('', 22)} | ${pad('* Attendance Days (ad)', 35)} | ${attendanceDays}`);
    doc.font('Courier-Bold').fontSize(10);
    doc.text(`${pad('', 22)} | ${pad('Pro-rated Salary = (ad/wd) * bs', 35)} | ${currency(proratedBaseSalary)}`);
    doc.font('Courier').fontSize(10);
    doc.text('----------------------------------------------------------------------------');

    doc.text(`${pad('Overtime', 22)} | ${pad('* Total Hours (hr)', 35)} | ${totalOT.toFixed(2)} hrs`);
    doc.text(`${pad('', 22)} | ${pad('* Hourly Rate', 35)} | ${currency(hourlyRate)}`);
    doc.text(`${pad('', 22)} | ${pad('* Multiplied Hourly Rate (x' + otMultiplier + ') (mp)', 35)} | ${currency(hourlyRate * otMultiplier)}`);
    doc.font('Courier-Bold').fontSize(10);
    doc.text(`${pad('', 22)} | ${pad('Overtime Pay = hr * mp', 35)} | ${currency(overtimePay)}`);
    doc.font('Courier').fontSize(10);
    doc.text('----------------------------------------------------------------------------');

    doc.font('Courier-Bold').fontSize(10);
    doc.text(`${pad('Reimbursements', 22)} | ${pad('Claimed Amounts', 35)} | ${currency(reimbursementTotal || 0)}`);
    doc.font('Courier').fontSize(10);
    doc.text('----------------------------------------------------------------------------');

    doc.font('Courier-Bold').fontSize(11);
    doc.text(`${pad('TOTAL TAKE-HOME PAY', 20)} | ${pad('', 31)} | ${currency(totalPay)}`);
    doc.text('----------------------------------------------------------------------------');

    doc.moveDown(2);
    doc.fontSize(10).font('Courier-Oblique').text(
      'This is a system-generated payslip. Please contact HR for any discrepancies.',
      { align: 'center' }
    );

    doc.end();

    stream.on('finish', () => {
      res.status(201).json({
        message: '✅ Payslip generated successfully.',
        payslip,
        pdf: `/pdf/payslip_${employeeId}_${payroll_period_id}.pdf`
      });
    });

  } catch (err) {
    console.error('[generatePayslip]', err);
    res.status(500).json({ message: '❌ Internal server error.' });
  }
};
