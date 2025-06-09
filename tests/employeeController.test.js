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
