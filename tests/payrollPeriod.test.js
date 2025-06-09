const request = require('supertest');
const app = require('../app');
const { sequelize, PayrollPeriod, Admin } = require('../models');
const bcrypt = require('bcrypt');

let token;
const endpoint = '/api/admin/payroll-period';

const sendRequest = (body = {}) => {
  return request(app)
    .post(endpoint)
    .set('Authorization', `Bearer ${token}`)
    .send(body);
};

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

  console.log('LOGIN RESPONSE:', res.statusCode, res.body);

  token = res.body.token;
  if (!token) throw new Error('Login failed, token not received');
});

afterEach(async () => {
  await PayrollPeriod.destroy({ where: {} });
});

afterAll(async () => {
  await sequelize.close();
});

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
