// tests/employeeController.test.js

const request = require('supertest');
const app = require('../app');
const moment = require('moment');
const bcrypt = require('bcrypt');
const {
  sequelize,
  PayrollPeriod,
  Employee,
  Attendance,
  Overtime,
  Reimbursement,
  Payslip
} = require('../models');

let token, employee;

beforeAll(async () => {
  await sequelize.sync({ force: true });
  jest.spyOn(console, 'error').mockImplementation(() => {});

  // Create test employee
  employee = await Employee.create({
    fullname: 'Test Employee',
    username: 'testuser',
    password: await bcrypt.hash('password', 10),
    salary: 3000,
  });

  // Login to get token
  const res = await request(app)
    .post('/api/auth/login')
    .send({ username: 'testuser', password: 'password' });

  token = res.body.token;
});

afterEach(async () => {
  await Attendance.destroy({ where: {} });
  await PayrollPeriod.destroy({ where: {} });
});

afterAll(async () => {
  await sequelize.close();
  console.error.mockRestore();
});

describe('🕘 Employee Attendance Submission', () => {
  const submitAttendance = () =>
    request(app)
      .post('/api/employees/attendance')
      .set('Authorization', `Bearer ${token}`);

  it('✅ 400 if weekend (Saturday)', async () => {
    const saturday = moment().isoWeekday(6);
    jest.spyOn(moment.prototype, 'startOf').mockReturnValue(saturday);

    const res = await submitAttendance();
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/weekends/);
    moment.prototype.startOf.mockRestore();
  });

  it('✅ 400 if weekend (Sunday)', async () => {
    const sunday = moment().isoWeekday(7);
    jest.spyOn(moment.prototype, 'startOf').mockReturnValue(sunday);

    const res = await submitAttendance();
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/weekends/);
    moment.prototype.startOf.mockRestore();
  });

  it('✅ 400 if no active payroll period', async () => {
    const res = await submitAttendance();
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/no active payroll period/i);
  });

  it('✅ 201 if attendance created successfully', async () => {
    const today = moment().startOf('day').format('YYYY-MM-DD');

    await PayrollPeriod.create({
      start_date: today,
      end_date: today,
      is_processed: false,
      created_by: 'testuser',
      updated_by: 'testuser',
      ip_address: '127.0.0.1',
    });

    const res = await submitAttendance();
    expect(res.status).toBe(201);
    expect(res.body.message).toMatch(/success/i);
  });

  it('✅ 200 if attendance already exists', async () => {
    const today = moment().startOf('day').format('YYYY-MM-DD');

    const period = await PayrollPeriod.create({
      start_date: today,
      end_date: today,
      is_processed: false,
      created_by: 'testuser',
      updated_by: 'testuser',
      ip_address: '127.0.0.1',
    });

    await Attendance.create({
      employee_id: employee.id,
      date: today,
      payroll_period_id: period.id,
      created_by: employee.id.toString(),
      updated_by: employee.id.toString(),
      ip_address: '127.0.0.1',
    });

    const res = await submitAttendance();
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/already submitted/i);
  });

  it('✅ 500 on unexpected error', async () => {
    jest.spyOn(PayrollPeriod, 'findOne').mockImplementationOnce(() => {
      throw new Error('Unexpected');
    });

    const res = await submitAttendance();
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/internal server error/i);
  });
});

describe('⏱️ Employee Overtime Submission', () => {
  const endpoint = '/api/employees/overtime';
  const submit = (payload) =>
    request(app).post(endpoint).set('Authorization', `Bearer ${token}`).send(payload);

  it('✅ 400 if date or hours is missing', async () => {
    const res = await submit({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/date and hours are required/i);
  });

  it('✅ 400 if invalid date format', async () => {
    const res = await submit({ date: '06-09-2025', hours: 2 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid date format/i);
  });

  it('✅ 400 if future date submitted', async () => {
    const future = moment().add(1, 'day').format('YYYY-MM-DD');
    const res = await submit({ date: future, hours: 2 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/future/i);
  });

  it('✅ 400 if hours > 3.0', async () => {
    const today = moment().format('YYYY-MM-DD');
    const res = await submit({ date: today, hours: 3.5 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/exceed 3 hours/i);
  });

  it('✅ 400 if no active payroll period', async () => {
    const today = moment().format('YYYY-MM-DD');
    const res = await submit({ date: today, hours: 2 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/no active payroll period/i);
  });

  it('✅ 201 if overtime created successfully', async () => {
    const today = moment().format('YYYY-MM-DD');
    await PayrollPeriod.create({
      start_date: today,
      end_date: today,
      is_processed: false,
      created_by: employee.id,
      updated_by: employee.id,
      ip_address: '127.0.0.1',
    });

    const res = await submit({ date: today, hours: 2 });
    expect(res.status).toBe(201);
    expect(res.body.message).toMatch(/success/i);
  });

  it('✅ 409 if overtime already submitted for date', async () => {
    const today = moment().format('YYYY-MM-DD');
    const period = await PayrollPeriod.create({
      start_date: today,
      end_date: today,
      is_processed: false,
      created_by: employee.id,
      updated_by: employee.id,
      ip_address: '127.0.0.1',
    });

    await Overtime.create({
      employee_id: employee.id,
      date: today,
      hours: 2,
      payroll_period_id: period.id,
      created_by: employee.id,
      updated_by: employee.id,
      ip_address: '127.0.0.1',
    });

    const res = await submit({ date: today, hours: 2 });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already submitted/i);
  });

  it('✅ 500 on unexpected error', async () => {
    jest.spyOn(PayrollPeriod, 'findOne').mockImplementationOnce(() => {
      throw new Error('Unexpected');
    });

    const today = moment().format('YYYY-MM-DD');
    const res = await submit({ date: today, hours: 2 });
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/internal server error/i);
  });
});

describe('💸 Reimbursement Submission', () => {
  const endpoint = '/api/employees/reimbursement';
  const postReimbursement = (payload = {}) =>
    request(app)
      .post(endpoint)
      .set('Authorization', `Bearer ${token}`)
      .send(payload);

  it('✅ 400 if amount is missing or not positive', async () => {
    const res1 = await postReimbursement({ amount: null });
    expect(res1.status).toBe(400);
    expect(res1.body.error).toMatch(/valid positive amount/i);

    const res2 = await postReimbursement({ amount: -50 });
    expect(res2.status).toBe(400);
    expect(res2.body.error).toMatch(/valid positive amount/i);

    const res3 = await postReimbursement({ amount: 'abc' });
    expect(res3.status).toBe(400);
    expect(res3.body.error).toMatch(/valid positive amount/i);
  });

  it('✅ 400 if date is invalid format', async () => {
    const res = await postReimbursement({ amount: 100, date: '2024/12/01' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid date format/i);
  });

  it('✅ 400 if no active payroll period for date', async () => {
    const res = await postReimbursement({
      amount: 150,
      date: moment().format('YYYY-MM-DD'),
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/no active payroll period/i);
  });

  it('✅ 201 reimbursement submitted successfully (with date)', async () => {
    const date = moment().format('YYYY-MM-DD');

    await PayrollPeriod.create({
      start_date: date,
      end_date: date,
      is_processed: false,
      created_by: 'admin',
      updated_by: 'admin',
      ip_address: '127.0.0.1',
    });

    const res = await postReimbursement({
      amount: 80.5,
      date,
      description: 'Client lunch',
    });

    expect(res.status).toBe(201);
    expect(res.body.message).toMatch(/reimbursement submitted/i);

    const created = await Reimbursement.findOne();
    expect(created).toBeTruthy();
    expect(created.amount).toBe('80.50');
    expect(created.description).toBe('Client lunch');
  });

  it('✅ 201 reimbursement submitted successfully (without date)', async () => {
    const today = moment().format('YYYY-MM-DD');

    await PayrollPeriod.create({
      start_date: today,
      end_date: today,
      is_processed: false,
      created_by: 'admin',
      updated_by: 'admin',
      ip_address: '127.0.0.1',
    });

    const res = await postReimbursement({ amount: 120 });
    expect(res.status).toBe(201);
    expect(res.body.message).toMatch(/reimbursement submitted/i);
  });

  it('✅ Handles null or empty description gracefully', async () => {
    const today = moment().format('YYYY-MM-DD');

    await PayrollPeriod.create({
      start_date: today,
      end_date: today,
      is_processed: false,
      created_by: 'admin',
      updated_by: 'admin',
      ip_address: '127.0.0.1',
    });

    const res = await postReimbursement({ amount: 99.99, description: '' });
    expect(res.status).toBe(201);

    const rec = await Reimbursement.findOne({ where: { amount: '99.99' } });
    expect(rec.description).toBe(null);
  });

  it('✅ 500 on unexpected error', async () => {
    jest
      .spyOn(PayrollPeriod, 'findOne')
      .mockImplementationOnce(() => Promise.reject(new Error('Boom')));

    const res = await postReimbursement({ amount: 10, date: moment().format('YYYY-MM-DD') });
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/internal server error/i);
  });
});

describe('📄 Employee Payslip Generation', () => {
  const endpoint = '/api/employees/generate-payslip';
  const generate = (payload = {}) =>
    request(app)
      .post(endpoint)
      .set('Authorization', `Bearer ${token}`)
      .send(payload);

  let period;

  beforeEach(async () => {
    await PayrollPeriod.destroy({ where: {} });
    await Attendance.destroy({ where: {} });
    await Overtime.destroy({ where: {} });
    await Reimbursement.destroy({ where: {} });
    await Payslip.destroy({ where: {} });

    // Create common payroll period for all tests
    period = await PayrollPeriod.create({
      start_date: '2025-06-01',
      end_date: '2025-06-07',
      is_processed: false,
      created_by: 'testuser',
      updated_by: 'testuser',
      ip_address: '127.0.0.1',
    });
  });

  it('✅ 400 if missing payroll_period_id', async () => {
    const res = await generate({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/❌ Payroll period not found./i);
  });

  it('✅ 400 if payroll_period_id is invalid or not found', async () => {
    const res = await generate({ payroll_period_id: 999999 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/❌ Payroll period not found./i);
  });

  it('✅ 409 if payslip already exists for this employee and period', async () => {
    await Payslip.create({
      employee_id: employee.id,
      payroll_period_id: period.id,
      base_salary: 3000,
      overtime_hours: 0,
      overtime_pay: 100,
      reimbursements: 0,
      attendance_days: 20,
      total_pay: 3100,
      pdf_path: '/fake/path.pdf',
      created_by: 'testuser',
      updated_by: 'testuser',
      ip_address: '127.0.0.1',
    });

    const res = await generate({ payroll_period_id: period.id });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/Payslip already generated/i);
  });

  it('✅ 201 generates payslip successfully and returns metadata', async () => {
    // Create related records
    await Attendance.create({
      employee_id: employee.id,
      date: '2025-06-03',
      payroll_period_id: period.id,
      created_by: employee.id.toString(),
      updated_by: employee.id.toString(),
      ip_address: '127.0.0.1',
    });

    await Overtime.create({
      employee_id: employee.id,
      date: '2025-06-03',
      hours: 2,
      payroll_period_id: period.id,
      created_by: employee.id.toString(),
      updated_by: employee.id.toString(),
      ip_address: '127.0.0.1',
    });

    await Reimbursement.create({
      employee_id: employee.id,
      date: '2025-06-04',
      amount: 100,
      payroll_period_id: period.id,
      description: 'Taxi fare',
      created_by: employee.id.toString(),
      updated_by: employee.id.toString(),
      ip_address: '127.0.0.1',
    });

    const res = await generate({ payroll_period_id: period.id });

    expect(res.status).toBe(201);
    expect(res.body.message).toMatch(/Payslip generated successfully/i);
    expect(res.body.payslip).toMatchObject({
      employee_id: employee.id,
      reimbursements: "100.00",
    });
    expect(res.body.pdf).toMatch(/\.pdf$/);

    // ATM, only stored as PDF file, no store to DB
    //   expect(slip.base_salary).toBe(3000);
    //   expect(slip.take_home_pay).toBe(3100); // 3000 + 0 (attendance) + 100 reimbursement
  });

  it('✅ 500 on unexpected error', async () => {
    jest
      .spyOn(PayrollPeriod, 'findByPk')
      .mockImplementationOnce(() => {
        throw new Error('Unexpected');
      });

    const res = await generate({ payroll_period_id: period.id });
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/internal server error/i);
  });
});
