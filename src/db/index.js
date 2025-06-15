// src/db/index.js
// DB entry point: initialize and export db

const { db, initDb } = require('./init');

initDb();

module.exports = db;
