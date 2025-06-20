const express = require('express');
const router = express.Router();
const db = require('../models/db');

// GET all dogs
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT d.dog_id, d.name, d.breed, d.size, d.owner_id, u.username as owner_name
      FROM Dogs d
      JOIN Users u ON d.owner_id = u.user_id
    `);

    res.json(rows);
  } catch (error) {
    console.error('SQL Error:', error);
    res.status(500).json({ error: 'Failed to fetch dogs' });
  }
});

// GET a specific dog by ID
router.get('/:id', async (req, res) => {
  const dogId = req.params.id;

  try {
    const [rows] = await db.query(`
      SELECT d.*, u.username as owner_name
      FROM Dogs d
      JOIN Users u ON d.owner_id = u.user_id
      WHERE d.dog_id = ?
    `, [dogId]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Dog not found' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('SQL Error:', error);
    res.status(500).json({ error: 'Failed to fetch dog' });
  }
});

module.exports = router;