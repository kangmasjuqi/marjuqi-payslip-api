const { sequelize, Employee, Admin } = require('../models');
const bcrypt = require('bcrypt');
const { faker } = require('@faker-js/faker');

async function seed() {
  try {
    // Reset and sync the DB
    await sequelize.sync({ force: true });

    const systemCreator = 'system';
    const systemIP = '127.0.0.1';

    // Create 100 employees with hashed passwords
    const employees = [];
    for (let i = 0; i < 100; i++) {
      const username = faker.internet.username();
      const password = await bcrypt.hash('password123', 10);
      const salary = faker.number.int({ min: 3000, max: 10000 });

      employees.push({
        username,
        password,
        salary,
        created_by: systemCreator,
        updated_by: systemCreator,
        ip_address: systemIP,
      });
    }

    await Employee.bulkCreate(employees);

    // Create admin user
    const adminPassword = await bcrypt.hash('admin123', 10);
    await Admin.create({
      username: 'admin',
      password: adminPassword,
      created_by: systemCreator,
      updated_by: systemCreator,
      ip_address: systemIP,
    });

    console.log('✅ Seed complete.');
  } catch (err) {
    console.error('❌ Seed error:', err);
  } finally {
    process.exit();
  }
}

seed();
