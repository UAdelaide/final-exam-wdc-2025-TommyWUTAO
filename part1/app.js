const express = require('express');
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 8080;

// Create initial database connection pool
let pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Insert test data function
async function insertTestData(connection) {
  try {
    // Insert users
    await connection.query(`
      INSERT INTO Users (username, email, password_hash, role)
      VALUES
      ('alice123', 'alice@example.com', 'hashed123', 'owner'),
      ('bobwalker', 'bob@example.com', 'hashed456', 'walker'),
      ('carol123', 'carol@example.com', 'hashed789', 'owner'),
      ('davidwalks', 'david@example.com', 'hashed101', 'walker'),
      ('emma_owner', 'emma@example.com', 'hashed202', 'owner')
    `);

    console.log('Users inserted');

    // Get user IDs
    const [users] = await connection.query('SELECT user_id, username FROM Users');
    const userMap = {};
    users.forEach((user) => {
      userMap[user.username] = user.user_id;
    });

    // Insert dogs
    await connection.query(`
      INSERT INTO Dogs (owner_id, name, size)
      VALUES
      (?, 'Max', 'medium'),
      (?, 'Bella', 'small'),
      (?, 'Rocky', 'large'),
      (?, 'Luna', 'small'),
      (?, 'Charlie', 'medium')
    `, [userMap['alice123'], userMap['carol123'], userMap['alice123'], userMap['emma_owner'], userMap['carol123']]);

    console.log('Dogs inserted');

    // Get dog IDs
    const [dogs] = await connection.query('SELECT dog_id, name, owner_id FROM Dogs');
    const dogMap = {};
    dogs.forEach((dog) => {
      dogMap[dog.name] = dog.dog_id;
    });

    // Insert walk requests
    await connection.query(`
      INSERT INTO WalkRequests (dog_id, requested_time, duration_minutes, location, status)
      VALUES
      (?, '2025-06-10 08:00:00', 30, 'Parklands', 'open'),
      (?, '2025-06-10 09:30:00', 45, 'Beachside Ave', 'accepted'),
      (?, '2025-06-11 15:00:00', 60, 'Downtown Park', 'open'),
      (?, '2025-06-12 10:15:00', 40, 'River Trail', 'open'),
      (?, '2025-06-12 16:30:00', 30, 'Hillside Path', 'completed')
    `, [dogMap['Max'], dogMap['Bella'], dogMap['Rocky'], dogMap['Luna'], dogMap['Charlie']]);

    console.log('Walk requests inserted');

    // Get walker IDs and request IDs
    const [requests] = await connection.query('SELECT request_id, status FROM WalkRequests WHERE status = "accepted" OR status = "completed"');
    const [walkers] = await connection.query('SELECT user_id, username FROM Users WHERE role = "walker"');

    if (requests.length > 0 && walkers.length > 0) {
      // Insert walk applications
      await connection.query(`
        INSERT INTO WalkApplications (request_id, walker_id, status)
        VALUES
        (?, ?, 'accepted'),
        (?, ?, 'accepted')
      `, [requests[0].request_id, walkers[0].user_id, requests[1].request_id, walkers[1].user_id]);

      console.log('Walk applications inserted');

      // Insert ratings
      await connection.query(`
        INSERT INTO WalkRatings (request_id, walker_id, owner_id, rating, comments)
        VALUES
        (?, ?, ?, 5, 'Great service!'),
        (?, ?, ?, 4, 'Good walker')
      `, [
        requests[0].request_id, walkers[0].user_id, userMap['carol123'],
        requests[1].request_id, walkers[1].user_id, userMap['alice123']
      ]);

      console.log('Ratings inserted');
    }

  } catch (err) {
    console.error('Test data insertion failed:', err);
    throw err;
  }
}

// Initialize database function
async function initializeDatabase() {
  try {
    // Connect to MySQL without specifying database
    const connection = await pool.getConnection();

    // Read SQL file content
    const sqlFilePath = path.join(__dirname, 'dogwalks.sql');
    const sqlScript = fs.readFileSync(sqlFilePath, 'utf8');

    // Split SQL statements
    const sqlStatements = sqlScript.split(';').filter((statement) => statement.trim());

    // Execute each SQL statement
    for (const statement of sqlStatements) {
      if (statement.trim()) {
        await connection.query(`${statement.trim()};`);
      }
    }
    console.log('Database initialized');

    // Use the DogWalkService database
    await connection.query('USE DogWalkService');

    // Insert test data
    await insertTestData(connection);

    // Release connection
    connection.release();

    // Create a new pool that's configured to use the DogWalkService database
    pool = mysql.createPool({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'DogWalkService',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

  } catch (err) {
    console.error('Database initialization failed:', err);
    process.exit(1);
  }
}

// API route - All dogs
app.get('/api/dogs', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT d.name AS dog_name, d.size, u.username AS owner_username
      FROM Dogs d
      JOIN Users u ON d.owner_id = u.user_id
    `);
    res.json(rows);
  } catch (error) {
    console.error('Failed to fetch dogs:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// API route - Open walk requests
app.get('/api/walkrequests/open', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT wr.request_id, d.name AS dog_name, wr.requested_time, wr.duration_minutes,
             wr.location, u.username AS owner_username
      FROM WalkRequests wr
      JOIN Dogs d ON wr.dog_id = d.dog_id
      JOIN Users u ON d.owner_id = u.user_id
      WHERE wr.status = 'open'
    `);
    res.json(rows);
  } catch (error) {
    console.error('Failed to fetch open walk requests:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// API route - Walkers summary
app.get('/api/walkers/summary', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT u.username AS walker_username,
             COUNT(wr.rating_id) AS total_ratings,
             AVG(wr.rating) AS average_rating,
             COUNT(DISTINCT wa.request_id) AS completed_walks
      FROM Users u
      LEFT JOIN WalkApplications wa ON u.user_id = wa.walker_id AND wa.status = 'accepted'
      LEFT JOIN WalkRatings wr ON u.user_id = wr.walker_id
      WHERE u.role = 'walker'
      GROUP BY u.user_id
    `);
    res.json(rows);
  } catch (error) {
    console.error('Failed to fetch walkers summary:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Initialize database and start server
initializeDatabase().then(() => {
  app.listen(port, () => {
    console.log(`API server running on port ${port}`);
  });
}).catch((err) => {
  console.error('Server startup failed:', err);
});