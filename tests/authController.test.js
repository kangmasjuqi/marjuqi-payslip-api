const request = require('supertest');
const express = require('express');
const authController = require('../controllers/authController');

// Mock dependencies
const { Employee, Admin } = require('../models');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Mock specific methods
jest.mock('../models', () => ({
  Employee: {
    findOne: jest.fn(),
  },
  Admin: {
    findOne: jest.fn(),
  },
}));

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(),
}));

// Set up a basic Express app to test the controller via HTTP requests
const app = express();
app.use(express.json()); // Essential for parsing req.body
app.post('/api/auth/login', authController.login);
app.post('/api/auth/admin/login', authController.loginAdmin);

describe('authController', () => {
  // Before each test, reset all mocks to their initial state
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test_jwt_secret'; // Ensure JWT_SECRET is set for tests
  });

  // --- Employee Login Tests ---
  describe('Employee Login', () => {
    it('should successfully log in an employee with valid credentials', async () => {
      // Arrange
      const mockEmployee = { id: 1, username: 'testuser', password: 'hashedpassword' };
      Employee.findOne.mockResolvedValue(mockEmployee); // DB finds employee
      bcrypt.compare.mockResolvedValue(true); // Password matches
      jwt.sign.mockReturnValue('mocked_employee_token'); // JWT signs token

      // Act
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'testuser', password: 'password123' });

      // Assert
      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual({ token: 'mocked_employee_token' });
      expect(Employee.findOne).toHaveBeenCalledWith({ where: { username: 'testuser' } });
      expect(bcrypt.compare).toHaveBeenCalledWith('password123', 'hashedpassword');
      expect(jwt.sign).toHaveBeenCalledWith({ id: mockEmployee.id }, 'test_jwt_secret', { expiresIn: '1d' });
    });

    it('should return 401 for invalid employee username', async () => {
      // Arrange
      Employee.findOne.mockResolvedValue(null); // DB does not find employee

      // Act
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'nonexistent', password: 'password123' });

      // Assert
      expect(res.statusCode).toEqual(401);
      expect(res.body).toEqual({ error: 'Invalid credentials, username not found' });
      expect(Employee.findOne).toHaveBeenCalledWith({ where: { username: 'nonexistent' } });
      expect(bcrypt.compare).not.toHaveBeenCalled(); // No need to compare password
      expect(jwt.sign).not.toHaveBeenCalled(); // No token generated
    });

    it('should return 401 for invalid employee password', async () => {
      // Arrange
      const mockEmployee = { id: 1, username: 'testuser', password: 'hashedpassword' };
      Employee.findOne.mockResolvedValue(mockEmployee); // DB finds employee
      bcrypt.compare.mockResolvedValue(false); // Password does not match

      // Act
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'testuser', password: 'wrongpassword' });

      // Assert
      expect(res.statusCode).toEqual(401);
      expect(res.body).toEqual({ error: 'Invalid credentials, password invalid' });
      expect(Employee.findOne).toHaveBeenCalledWith({ where: { username: 'testuser' } });
      expect(bcrypt.compare).toHaveBeenCalledWith('wrongpassword', 'hashedpassword');
      expect(jwt.sign).not.toHaveBeenCalled(); // No token generated
    });

    it('should return 500 for internal server error during employee login', async () => {
      // Arrange
      Employee.findOne.mockRejectedValue(new Error('DB connection failed')); // Simulate a DB error
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {}); // Suppress console error

      // Act
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'testuser', password: 'password123' });

      // Assert
      expect(res.statusCode).toEqual(500);
      expect(res.body).toEqual({ error: 'Internal Server Error' });
      expect(Employee.findOne).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith('Login error:', expect.any(Error));
      consoleErrorSpy.mockRestore(); // Restore console.error
    });
  });

  // --- Admin Login Tests ---
  describe('Admin Login', () => {
    it('should successfully log in an admin with valid credentials', async () => {
      // Arrange
      const mockAdmin = { id: 10, username: 'admin', password: 'hashedadminpassword' };
      Admin.findOne.mockResolvedValue(mockAdmin); // DB finds admin
      bcrypt.compare.mockResolvedValue(true); // Password matches
      jwt.sign.mockReturnValue('mocked_admin_token'); // JWT signs token

      // Act
      const res = await request(app)
        .post('/api/auth/admin/login')
        .send({ username: 'admin', password: 'admin123' });

      // Assert
      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual({ token: 'mocked_admin_token' });
      expect(Admin.findOne).toHaveBeenCalledWith({ where: { username: 'admin' } });
      expect(bcrypt.compare).toHaveBeenCalledWith('admin123', 'hashedadminpassword');
      expect(jwt.sign).toHaveBeenCalledWith({ id: mockAdmin.id }, 'test_jwt_secret', { expiresIn: '1d' });
    });

    it('should return 401 for invalid admin username', async () => {
      // Arrange
      Admin.findOne.mockResolvedValue(null); // DB does not find admin

      // Act
      const res = await request(app)
        .post('/api/auth/admin/login')
        .send({ username: 'nonexistent_admin', password: 'admin123' });

      // Assert
      expect(res.statusCode).toEqual(401);
      expect(res.body).toEqual({ error: 'Invalid admin credentials, username not found' });
      expect(Admin.findOne).toHaveBeenCalledWith({ where: { username: 'nonexistent_admin' } });
      expect(bcrypt.compare).not.toHaveBeenCalled();
      expect(jwt.sign).not.toHaveBeenCalled();
    });

    it('should return 401 for invalid admin password', async () => {
      // Arrange
      const mockAdmin = { id: 10, username: 'admin', password: 'hashedadminpassword' };
      Admin.findOne.mockResolvedValue(mockAdmin); // DB finds admin
      bcrypt.compare.mockResolvedValue(false); // Password does not match

      // Act
      const res = await request(app)
        .post('/api/auth/admin/login')
        .send({ username: 'admin', password: 'wrongadminpassword' });

      // Assert
      expect(res.statusCode).toEqual(401);
      expect(res.body).toEqual({ error: 'Invalid admin credentials, password invalid' });
      expect(Admin.findOne).toHaveBeenCalledWith({ where: { username: 'admin' } });
      expect(bcrypt.compare).toHaveBeenCalledWith('wrongadminpassword', 'hashedadminpassword');
      expect(jwt.sign).not.toHaveBeenCalled();
    });

    it('should return 500 for internal server error during admin login', async () => {
      // Arrange
      Admin.findOne.mockRejectedValue(new Error('DB connection failed for admin')); // Simulate a DB error
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {}); // Suppress console error

      // Act
      const res = await request(app)
        .post('/api/auth/admin/login')
        .send({ username: 'admin', password: 'admin123' });

      // Assert
      expect(res.statusCode).toEqual(500);
      expect(res.body).toEqual({ error: 'Internal Server Error' });
      expect(Admin.findOne).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith('Login error:', expect.any(Error));
      consoleErrorSpy.mockRestore(); // Restore console.error
    });
  });
});