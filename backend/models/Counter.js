const mongoose = require('mongoose');

// Simple atomic counter collection, used to generate sequential,
// human-readable reference codes (e.g. ENQ-2026-000042) without race conditions.
const counterSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  seq: { type: Number, default: 0 },
});

module.exports = mongoose.model('Counter', counterSchema);
