const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const Admin = require('../models/Admin');
const AuditLog = require('../models/AuditLog');

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_TIME_MS = 15 * 60 * 1000; // 15 minutes

function signToken(admin) {
  return jwt.sign({ id: admin._id, role: admin.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  });
}

// @desc    Authenticate admin and issue JWT
// @route   POST /api/auth/login
// @access  Public (rate limited)
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const ip = req.ip;

  const admin = await Admin.findOne({ email }).select('+passwordHash');

  if (!admin) {
    res.status(401);
    throw new Error('Invalid email or password');
  }

  if (admin.isLocked()) {
    const minutesLeft = Math.ceil((admin.lockUntil - Date.now()) / 60000);
    res.status(423);
    throw new Error(`Account temporarily locked. Try again in ${minutesLeft} minute(s).`);
  }

  const isMatch = await admin.comparePassword(password);

  if (!isMatch) {
    admin.failedLoginAttempts += 1;
    if (admin.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
      admin.lockUntil = Date.now() + LOCK_TIME_MS;
      admin.failedLoginAttempts = 0;
    }
    await admin.save();

    await AuditLog.create({
      actor: admin._id,
      actorName: admin.name,
      action: 'ADMIN_LOGIN_FAILED',
      ipAddress: ip,
    });

    res.status(401);
    throw new Error('Invalid email or password');
  }

  if (!admin.isActive) {
    res.status(403);
    throw new Error('This account has been deactivated');
  }

  admin.failedLoginAttempts = 0;
  admin.lockUntil = undefined;
  admin.lastLoginAt = new Date();
  await admin.save();

  await AuditLog.create({
    actor: admin._id,
    actorName: admin.name,
    action: 'ADMIN_LOGIN',
    ipAddress: ip,
  });

  const token = signToken(admin);

  res.json({
    success: true,
    token,
    admin: {
      id: admin._id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
    },
  });
});

// @desc    Get current authenticated admin profile
// @route   GET /api/auth/me
// @access  Private
const getMe = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    admin: {
      id: req.admin._id,
      name: req.admin.name,
      email: req.admin.email,
      role: req.admin.role,
      lastLoginAt: req.admin.lastLoginAt,
    },
  });
});

module.exports = { login, getMe };
