// routes/auth.js
const express = require('express');
const { login, loginAdmin } = require('../controllers/authController');
const router = express.Router();

router.post('/login', login);
router.post('/admin/login', loginAdmin);

module.exports = router;
