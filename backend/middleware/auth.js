const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const Admin = require('../models/Admin');


const protect = asyncHandler(async (req, res, next) => {
  let token;
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  if (!token) {
    res.status(401);
    throw new Error('Not authorized. No token provided.');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const admin = await Admin.findById(decoded.id);

    if (!admin || !admin.isActive) {
      res.status(401);
      throw new Error('Not authorized. Account is inactive or does not exist.');
    }

    req.admin = admin;
    next();
  } catch (err) {
    res.status(401);
    throw new Error('Not authorized. Token is invalid or expired.');
  }
});


const requireRole = (...roles) => (req, res, next) => {
  if (!req.admin || !roles.includes(req.admin.role)) {
    res.status(403);
    throw new Error('Forbidden. Insufficient permissions.');
  }
  next();
};

module.exports = { protect, requireRole };
