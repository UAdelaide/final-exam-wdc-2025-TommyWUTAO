const express = require('express');
const router = express.Router();
const db = require('../models/db');

// GET all walks
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT w.*, u.username as owner_name
      FROM Walks w
      JOIN Users u ON w.owner_id = u.user_id
    `);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching walks:', error);
    res.status(500).json({ error: 'Failed to fetch walks' });
  }
});

// GET walks by owner_id
router.get('/owner/:ownerId', async (req, res) => {
  try {
    const { ownerId } = req.params;
    const [rows] = await db.query(`
      SELECT * FROM Walks
      WHERE owner_id = ?
      ORDER BY walk_date DESC, walk_time DESC
    `, [ownerId]);

    res.json(rows);
  } catch (error) {
    console.error('Error fetching owner walks:', error);
    res.status(500).json({ error: 'Failed to fetch walks for owner' });
  }
});

// GET walks by walker_id
router.get('/walker/:walkerId', async (req, res) => {
  try {
    const { walkerId } = req.params;
    const [rows] = await db.query(`
      SELECT w.*, u.username as owner_name
      FROM Walks w
      JOIN Users u ON w.owner_id = u.user_id
      WHERE w.walker_id = ?
      ORDER BY walk_date DESC, walk_time DESC
    `, [walkerId]);

    res.json(rows);
  } catch (error) {
    console.error('Error fetching walker walks:', error);
    res.status(500).json({ error: 'Failed to fetch walks for walker' });
  }
});

// GET open walk requests
router.get('/open', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT w.*, u.username as owner_name
      FROM Walks w
      JOIN Users u ON w.owner_id = u.user_id
      WHERE w.status = 'pending' AND w.walker_id IS NULL
      ORDER BY walk_date ASC, walk_time ASC
    `);

    res.json(rows);
  } catch (error) {
    console.error('Error fetching open walks:', error);
    res.status(500).json({ error: 'Failed to fetch open walks' });
  }
});

// POST create a new walk
router.post('/', async (req, res) => {
  const { owner_id, dog_name, walk_date, walk_time, duration, status } = req.body;

  try {
    const [result] = await db.query(`
      INSERT INTO Walks (owner_id, dog_name, walk_date, walk_time, duration, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [owner_id, dog_name, walk_date, walk_time, duration, status || 'pending']);

    res.status(201).json({
      message: 'Walk request created successfully',
      walk_id: result.insertId
    });
  } catch (error) {
    console.error('Error creating walk:', error);
    res.status(500).json({ error: 'Failed to create walk request' });
  }
});

// PUT update a walk status to accepted
router.put('/:walkId/accept', async (req, res) => {
  const { walkId } = req.params;
  const { walker_id } = req.body;

  try {
    // Check if walk exists and is still pending
    const [walkCheck] = await db.query(`
      SELECT * FROM Walks WHERE walk_id = ? AND status = 'pending'
    `, [walkId]);

    if (walkCheck.length === 0) {
      return res.status(400).json({ error: 'Walk request not found or already accepted' });
    }

    // Update the walk
    await db.query(`
      UPDATE Walks
      SET status = 'accepted', walker_id = ?
      WHERE walk_id = ?
    `, [walker_id, walkId]);

    res.json({ message: 'Walk request accepted successfully' });
  } catch (error) {
    console.error('Error accepting walk:', error);
    res.status(500).json({ error: 'Failed to accept walk request' });
  }
});

// PUT update a walk status to completed
router.put('/:walkId/complete', async (req, res) => {
  const { walkId } = req.params;

  try {
    // Check if walk exists and is accepted
    const [walkCheck] = await db.query(`
      SELECT * FROM Walks WHERE walk_id = ? AND status = 'accepted'
    `, [walkId]);

    if (walkCheck.length === 0) {
      return res.status(400).json({ error: 'Walk request not found or not in accepted status' });
    }

    // Update the walk
    await db.query(`
      UPDATE Walks
      SET status = 'completed'
      WHERE walk_id = ?
    `, [walkId]);

    res.json({ message: 'Walk marked as completed successfully' });
  } catch (error) {
    console.error('Error completing walk:', error);
    res.status(500).json({ error: 'Failed to mark walk as completed' });
  }
});

// DELETE a walk request
router.delete('/:walkId', async (req, res) => {
  const { walkId } = req.params;

  try {
    // Only allow deletion of pending walks
    const [result] = await db.query(`
      DELETE FROM Walks
      WHERE walk_id = ? AND status = 'pending'
    `, [walkId]);

    if (result.affectedRows === 0) {
      return res.status(400).json({ error: 'Walk request not found or cannot be deleted' });
    }

    res.json({ message: 'Walk request deleted successfully' });
  } catch (error) {
    console.error('Error deleting walk:', error);
    res.status(500).json({ error: 'Failed to delete walk request' });
  }
});

module.exports = router;