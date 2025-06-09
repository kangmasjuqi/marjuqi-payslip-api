const request = require('supertest');
const app = require('../server');
const { sequelize, PayrollPeriod } = require('../models');

beforeAll(async () => {
  await sequelize.sync({ force: true });
});

afterEach(async () => {
  await PayrollPeriod.destroy({ where: {} });
});

afterAll(async () => {
  await sequelize.close();
});

describe('POST /api/admin/payroll-periods', () => {
  const endpoint = '/api/admin/payroll-periods';

  const sendRequest = (body = {}, token = 'Bearer faketoken') => {
    return request(app)
      .post(endpoint)
      .set('Authorization', token) // depends on your authMiddleware
      .send(body);
  };

  it('❌ returns 400 if start_date is after end_date', async () => {
    const res = await sendRequest({
      start_date: '2025-07-01',
      end_date: '2025-06-01',
    });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/Start date must be before end date/i);
  });

  it('❌ returns 409 if period overlaps', async () => {
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

  it('❌ returns 400 if missing required fields', async () => {
    const res = await sendRequest({});

    expect(res.statusCode).toBe(400);
    expect(res.body.errors).toBeDefined();
  });
});
