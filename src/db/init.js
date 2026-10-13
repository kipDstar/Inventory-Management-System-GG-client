// src/db/init.js
const db = require('../db');

module.exports = { db, initDb: () => db.ready };
