// tests/adminController.test.js

const request = require('supertest');
const app = require('../app');
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
const bcrypt = require('bcrypt');
const { Op } = require('sequelize');
const { safeNumber, countWorkingDays } = require('../utils/helpers');

let token;

const payrollRunEndpoint = (period_id) => `/api/admin/run-payroll/${period_id}`;

const payslipSummaryEndpoint = (period_id) => `/api/admin/payslips/summary/${period_id}`;

beforeAll(async () => {
  await sequelize.sync({ force: true });

  // Create admin user
  const hashedPassword = await bcrypt.hash('admin123', 10);

  await Admin.create({
    username: 'admin',
    password: hashedPassword,
  });

  // Login admin
  const res = await request(app)
    .post('/api/auth/admin/login')
    .send({ username: 'admin', password: 'admin123' });

  token = res.body.token;
  if (!token) throw new Error('Login failed, token not received');
});

afterEach(async () => {
  await PayrollPeriod.destroy({ where: {} });
  await Employee.destroy({ where: {} });
  await Attendance.destroy({ where: {} });
  await Overtime.destroy({ where: {} });
  await Reimbursement.destroy({ where: {} });
  await Payslip.destroy({ where: {} });
});

afterAll(async () => {
  await sequelize.close();
});

const sendRequest = (body = {}) => {
  return request(app)
    .post('/api/admin/payroll-period')
    .set('Authorization', `Bearer ${token}`)
    .send(body);
};

describe('POST /api/admin/payroll-period', () => {
  it('✅ returns 400 if start_date is after end_date', async () => {
    const res = await sendRequest({
      start_date: '2025-07-01',
      end_date: '2025-06-01',
    });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/Start date must be before end date/i);
  });

  it('✅ returns 409 if period overlaps', async () => {
    await PayrollPeriod.create({
      start_date: '2025-06-01',
      end_date: '2025-06-30',
      is_processed: false,
      created_by: 'admin',
      updated_by: 'admin',
      ip_address: '127.0.0.1',
    });

    const res = await sendRequest({
      start_date: '2025-06-15',
      end_date: '2025-07-15',
    });

    expect(res.statusCode).toBe(409);
    expect(res.body.message).toMatch(/Period overlaps/i);
  });

  it('✅ creates payroll period successfully', async () => {
    const res = await sendRequest({
      start_date: '2025-08-01',
      end_date: '2025-08-31',
    });

    expect(res.statusCode).toBe(201);
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.message).toMatch(/successfully/i);
  });

  it('✅ returns 400 if missing required fields', async () => {
    const res = await sendRequest({});

    expect(res.statusCode).toBe(400);
    expect(res.body.errors).toBeDefined();
  });
});

describe('Payroll Controller Integration Tests', () => {
  describe('POST /api/admin/payroll/run/:period_id', () => {
    it('✅ returns 404 if payroll period not found', async () => {
      const res = await request(app)
        .post(payrollRunEndpoint(999))
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toMatch(/not found/i);
    });

    it('✅ returns 400 if payroll already processed', async () => {
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

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/already processed/i);
    });

    it('✅ processes payroll and creates payslips', async () => {
      // Create payroll period
      const period = await PayrollPeriod.create({
        start_date: '2025-06-01',
        end_date: '2025-06-30',
        is_processed: false,
        created_by: 'admin',
        updated_by: 'admin',
        ip_address: '127.0.0.1',
      });

      // Create employee
      const hashedPasswordUser = await bcrypt.hash('password123', 10);

      const employee = await Employee.create({
        fullname: 'Alice',
        username: 'alice',
        password: hashedPasswordUser,
        salary: 3200,
      });

      // Create attendance for 20 days
      const attendanceCount = 20;
      for (let i = 1; i <= attendanceCount; i++) {
        await Attendance.create({
          payroll_period_id: period.id,
          employee_id: employee.id,
          date: `2025-06-${i.toString().padStart(2, '0')}`,
        });
      }

      // Create 5 hours of overtime spread over 2 days
      await Overtime.bulkCreate([
        { employee_id: employee.id, payroll_period_id: period.id, date: '2025-06-15', hours: 3 },
        { employee_id: employee.id, payroll_period_id: period.id, date: '2025-06-20', hours: 2 },
      ]);

      // Create reimbursements
      await Reimbursement.create({
        employee_id: employee.id,
        payroll_period_id: period.id,
        amount: 100,
        date: '2025-06-10',
      });

      const res = await request(app)
        .post(payrollRunEndpoint(period.id))
        .set('Authorization', `Bearer ${token}`)
        .set('X-Forwarded-For', '1.2.3.4'); // simulate IP

      expect(res.statusCode).toBe(200);
      expect(res.body.message).toMatch(/successfully/i);
      expect(res.body.summary.processed_employees).toBe(1);

      // Verify payslip created correctly
      const payslip = await Payslip.findOne({ where: { employee_id: employee.id, payroll_period_id: period.id } });
      expect(payslip).not.toBeNull();

      // Check that period is marked processed
      const updatedPeriod = await PayrollPeriod.findByPk(period.id);
      expect(updatedPeriod.is_processed).toBe(true);
      expect(updatedPeriod.ip_address).toBe('::ffff:127.0.0.1'); // supertest uses localhost, or use X-Forwarded-For

      // Validate some payslip numeric correctness (approx)
        
      const workingDays = countWorkingDays(period.start_date, period.end_date);
      const attendanceFactor = attendanceCount / workingDays;
        
      expect(parseFloat(payslip.base_salary)).toBeCloseTo((3200 * attendanceFactor), 2); // assuming 22 working days in June
      expect(parseFloat(payslip.reimbursements)).toBeCloseTo(100, 2);
      expect(parseFloat(payslip.overtime_hours)).toBeCloseTo(5, 2);
    });

    it('✅ returns 500 if exception thrown', async () => {
      // Force PayrollPeriod.findByPk to throw
      jest.spyOn(PayrollPeriod, 'findByPk').mockImplementationOnce(() => {
        throw new Error('DB error');
      });

      const res = await request(app)
        .post(payrollRunEndpoint(1))
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(500);
      expect(res.body.message).toMatch(/internal server error/i);
    });
  });

  describe('GET /api/admin/payroll/summary/:payroll_period_id', () => {
    it('✅ returns 404 if payroll period not found', async () => {
      const res = await request(app)
        .get(payslipSummaryEndpoint(999))
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toMatch(/not found/i);
    });

    it('✅ returns 404 if no payslips found', async () => {
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

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toMatch(/no payslips found/i);
    });

    it('✅ returns payslip summary correctly', async () => {
      const period = await PayrollPeriod.create({
        start_date: '2025-06-01',
        end_date: '2025-06-30',
        is_processed: true,
        created_by: 'admin',
        updated_by: 'admin',
        ip_address: '127.0.0.1',
      });

      const hashedPasswordUser = await bcrypt.hash('password123', 10);

      const emp1 = await Employee.create({
        fullname: 'Bob',
        username: 'bob',
        password: hashedPasswordUser,
        salary: 3000,
      });
        
      const emp2 = await Employee.create({
        fullname: 'Carol',
        username: 'carol',
        password: hashedPasswordUser,
        salary: 4000,
      });
        
      await Payslip.bulkCreate([
        {
          employee_id: emp1.id,
          payroll_period_id: period.id,
          base_salary: '2800',
          attendance_days: 20,
          overtime_hours: '5',
          overtime_pay: '100',
          reimbursements: '50',
          total_pay: '2950',
          created_by: 'admin',
          updated_by: 'admin',
          ip_address: '127.0.0.1',
        },
        {
          employee_id: emp2.id,
          payroll_period_id: period.id,
          base_salary: '3700',
          attendance_days: 21,
          overtime_hours: '3',
          overtime_pay: '80',
          reimbursements: '70',
          total_pay: '3850',
          created_by: 'admin',
          updated_by: 'admin',
          ip_address: '127.0.0.1',
        },
      ]);

      const res = await request(app)
        .get(payslipSummaryEndpoint(period.id))
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.period).toMatch(/2025-06-01 to 2025-06-30/);
      expect(res.body.summary).toHaveLength(2);
      expect(res.body.total_take_home).toBe('6800.00');
    });

    it('✅ returns 500 if exception thrown', async () => {
      jest.spyOn(PayrollPeriod, 'findByPk').mockImplementationOnce(() => {
        throw new Error('DB error');
      });

      const res = await request(app)
        .get(payslipSummaryEndpoint(1))
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(500);
      expect(res.body.message).toMatch(/internal server error/i);
    });
  });
});
