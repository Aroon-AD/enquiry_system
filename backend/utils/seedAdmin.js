require('dotenv').config();
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const Admin = require('../models/Admin');
const logger = require('./logger');

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);

  const email = process.env.SEED_ADMIN_EMAIL;
  const existing = await Admin.findOne({ email });

  if (existing) {
    logger.info(`Admin with email ${email} already exists. Skipping seed.`);
    process.exit(0);
  }

  const salt = await bcrypt.genSalt(Number(process.env.BCRYPT_SALT_ROUNDS) || 12);
  const passwordHash = await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD, salt);

  const admin = await Admin.create({
    name: process.env.SEED_ADMIN_NAME || 'System Administrator',
    email,
    passwordHash,
    role: 'superadmin',
  });

  logger.info(`Superadmin created: ${admin.email}`);
  logger.warn('Log in and change the seeded password immediately in a production environment.');
  process.exit(0);
}

seed().catch((err) => {
  logger.error(`Seeding failed: ${err.message}`);
  process.exit(1);
});
