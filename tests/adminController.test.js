// tests/adminController.test.js

const request = require('supertest');
const app = require('../app');
const bcrypt = require('bcrypt');
const { faker } = require('@faker-js/faker');
const {
  sequelize,
  PayrollPeriod,
  Admin,
  Employee,
  Attendance,
  Overtime,
  Reimbursement,
  Payslip,
} = require('../models');
const { countWorkingDays } = require('../utils/helpers');

let token;

const payrollRunEndpoint = (period_id) => `/api/admin/run-payroll/${period_id}`;
const payslipSummaryEndpoint = (period_id) => `/api/admin/payslips/summary/${period_id}`;

beforeAll(async () => {
  await sequelize.sync({ force: true });
  jest.spyOn(console, 'error').mockImplementation(() => {});

  const admin = await Admin.create({
    username: 'admin',
    password: await bcrypt.hash('admin123', 10),
  });

  const res = await request(app)
    .post('/api/auth/admin/login')
    .send({ username: 'admin', password: 'admin123' });

  token = res.body.token;
});

afterEach(async () => {
  await Promise.all([
    PayrollPeriod.destroy({ where: {} }),
    Employee.destroy({ where: {} }),
    Attendance.destroy({ where: {} }),
    Overtime.destroy({ where: {} }),
    Reimbursement.destroy({ where: {} }),
    Payslip.destroy({ where: {} }),
  ]);
});

afterAll(async () => {
  await sequelize.close();
  console.error.mockRestore();
});

const sendPayrollPeriodRequest = (body = {}) =>
  request(app)
    .post('/api/admin/payroll-period')
    .set('Authorization', `Bearer ${token}`)
    .send(body);

describe('📅 Payroll Period Creation', () => {
  it('✅ 400 if start_date > end_date', async () => {
    const res = await sendPayrollPeriodRequest({
      start_date: '2025-07-01',
      end_date: '2025-06-01',
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/start date must be before end date/i);
  });

  it('✅ 409 on overlapping period', async () => {
    await PayrollPeriod.create({
      start_date: '2025-06-01',
      end_date: '2025-06-30',
      created_by: 'admin',
      updated_by: 'admin',
      ip_address: '127.0.0.1',
    });

    const res = await sendPayrollPeriodRequest({
      start_date: '2025-06-15',
      end_date: '2025-07-15',
    });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/period overlaps/i);
  });

  it('✅ 201 on success', async () => {
    const res = await sendPayrollPeriodRequest({
      start_date: '2025-08-01',
      end_date: '2025-08-31',
    });

    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.message).toMatch(/success/i);
  });

  it('✅ 400 on missing fields', async () => {
    const res = await sendPayrollPeriodRequest({});
    expect(res.status).toBe(400);
    expect(res.body.errors).toBeDefined();
  });
});

describe('🧮 Payroll Processing', () => {
  describe('POST /api/admin/run-payroll/:id', () => {
    it('✅ 404 for non-existent period', async () => {
      const res = await request(app)
        .post(payrollRunEndpoint(999))
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });

    it('✅ 400 for already processed', async () => {
      const period = await PayrollPeriod.create({
        start_date: '2025-06-01',
        end_date: '2025-06-30',
        is_processed: true,
        created_by: 'admin',
        updated_by: 'admin',
        ip_address: '127.0.0.1',
      });

      const res = await request(app)
        .post(payrollRunEndpoint(period.id))
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/already processed/i);
    });

    it('✅ processes full flow with payslip', async () => {
      const period = await PayrollPeriod.create({
        start_date: '2025-06-01',
        end_date: '2025-06-30',
        is_processed: false,
        created_by: 'admin',
        updated_by: 'admin',
        ip_address: '127.0.0.1',
      });

      const employee = await Employee.create({
        fullname: faker.person.fullName(),
        username: faker.internet.username(),
        password: await bcrypt.hash('password', 10),
        salary: 3200,
      });

      // Attendance for 20 days
      for (let d = 1; d <= 20; d++) {
        await Attendance.create({
          payroll_period_id: period.id,
          employee_id: employee.id,
          date: `2025-06-${String(d).padStart(2, '0')}`,
        });
      }

      // Overtime
      await Overtime.bulkCreate([
        { employee_id: employee.id, payroll_period_id: period.id, date: '2025-06-10', hours: 2 },
        { employee_id: employee.id, payroll_period_id: period.id, date: '2025-06-15', hours: 3 },
      ]);

      // Reimbursement
      await Reimbursement.create({
        employee_id: employee.id,
        payroll_period_id: period.id,
        date: '2025-06-20',
        amount: 100,
      });

      const res = await request(app)
        .post(payrollRunEndpoint(period.id))
        .set('Authorization', `Bearer ${token}`)
        .set('X-Forwarded-For', '123.123.123.123');

      expect(res.status).toBe(200);
      expect(res.body.summary.processed_employees).toBe(1);

      const payslip = await Payslip.findOne({
        where: { employee_id: employee.id, payroll_period_id: period.id },
      });

      const workingDays = countWorkingDays('2025-06-01', '2025-06-30');
      const baseSalary = 3200 * (20 / workingDays);

      expect(parseFloat(payslip.base_salary)).toBeCloseTo(baseSalary, 2);
      expect(parseFloat(payslip.overtime_hours)).toBeCloseTo(5, 2);
      expect(parseFloat(payslip.reimbursements)).toBeCloseTo(100, 2);

      const updatedPeriod = await PayrollPeriod.findByPk(period.id);
      expect(updatedPeriod.is_processed).toBe(true);
    });

    it('✅ 500 on unexpected error', async () => {
      jest.spyOn(PayrollPeriod, 'findByPk').mockImplementationOnce(() => {
        throw new Error('Unexpected DB error');
      });

      const res = await request(app)
        .post(payrollRunEndpoint(1))
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(500);
      expect(res.body.message).toMatch(/internal server error/i);
    });
  });
});

describe('📊 Payslip Summary', () => {
  describe('GET /api/admin/payslips/summary/:id', () => {
    it('✅ 404 if period not found', async () => {
      const res = await request(app)
        .get(payslipSummaryEndpoint(999))
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });

    it('✅ 404 if no payslips exist', async () => {
      const period = await PayrollPeriod.create({
        start_date: '2025-06-01',
        end_date: '2025-06-30',
        is_processed: true,
        created_by: 'admin',
        updated_by: 'admin',
        ip_address: '127.0.0.1',
      });

      const res = await request(app)
        .get(payslipSummaryEndpoint(period.id))
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/no payslips found/i);
    });

    it('✅ returns detailed summary', async () => {
      const period = await PayrollPeriod.create({
        start_date: '2025-06-01',
        end_date: '2025-06-30',
        is_processed: true,
        created_by: 'admin',
        updated_by: 'admin',
        ip_address: '127.0.0.1',
      });

      const emp1 = await Employee.create({ username: 'bob', password: 'x', fullname: 'Bob', salary: 3000 });
      const emp2 = await Employee.create({ username: 'carol', password: 'x', fullname: 'Carol', salary: 4000 });

      await Payslip.bulkCreate([
        {
          employee_id: emp1.id,
          payroll_period_id: period.id,
          base_salary: '2800.00',
          attendance_days: 20,
          overtime_hours: '5',
          overtime_pay: '100',
          reimbursements: '50',
          total_pay: '2950.00',
          created_by: 'admin',
          updated_by: 'admin',
          ip_address: '127.0.0.1',
        },
        {
          employee_id: emp2.id,
          payroll_period_id: period.id,
          base_salary: '3700.00',
          attendance_days: 21,
          overtime_hours: '3',
          overtime_pay: '80',
          reimbursements: '70',
          total_pay: '3850.00',
          created_by: 'admin',
          updated_by: 'admin',
          ip_address: '127.0.0.1',
        },
      ]);

      const res = await request(app)
        .get(payslipSummaryEndpoint(period.id))
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.summary).toHaveLength(2);
      expect(res.body.total_take_home).toBe('6800.00');
      expect(res.body.period).toContain('2025-06-01');
    });

    it('✅ 500 on internal failure', async () => {
      jest.spyOn(PayrollPeriod, 'findByPk').mockImplementationOnce(() => {
        throw new Error('Error');
      });

      const res = await request(app)
        .get(payslipSummaryEndpoint(1))
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(500);
    });
  });
});
