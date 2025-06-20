const express = require('express');
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 8080;

const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function initializeDatabase() {
  try {
    const sqlFilePath = path.join(__dirname, 'dogwalks.sql');
    const sqlScript = fs.readFileSync(sqlFilePath, 'utf8');
    const sqlStatements = sqlScript.split(';').filter(statement => statement.trim());
    const connection = await pool.getConnection();

    for (const statement of sqlStatements) {
      if (statement.trim()) {
        await connection.query(`${statement.trim()};`);
      }
    }
    console.log('dā');


    await insertTestData(connection);

    // 释放连接
    connection.release();
  } catch (err) {
    console.error('数据库初始化失败:', err);
    process.exit(1);
  }
}

// 插入测试数据
async function insertTestData(connection) {
  try {
    // 插入用户
    await connection.query(`
      INSERT INTO Users (username, email, password_hash, role)
      VALUES
      ('alice123', 'alice@example.com', 'hashed123', 'owner'),
      ('bobwalker', 'bob@example.com', 'hashed456', 'walker'),
      ('carol123', 'carol@example.com', 'hashed789', 'owner'),
      ('davidwalks', 'david@example.com', 'hashed101', 'walker'),
      ('emma_owner', 'emma@example.com', 'hashed202', 'owner')
    `);

    console.log('用户数据插入成功');

    // 获取用户ID
    const [users] = await connection.query('SELECT user_id, username FROM Users');
    const userMap = {};
    users.forEach(user => {
      userMap[user.username] = user.user_id;
    });

    // 插入狗狗数据
    await connection.query(`
      INSERT INTO Dogs (owner_id, name, size)
      VALUES
      (?, 'Max', 'medium'),
      (?, 'Bella', 'small'),
      (?, 'Rocky', 'large'),
      (?, 'Luna', 'small'),
      (?, 'Charlie', 'medium')
    `, [userMap['alice123'], userMap['carol123'], userMap['alice123'], userMap['emma_owner'], userMap['carol123']]);

    console.log('狗狗数据插入成功');

    // 获取狗狗ID
    const [dogs] = await connection.query('SELECT dog_id, name, owner_id FROM Dogs');
    const dogMap = {};
    dogs.forEach(dog => {
      dogMap[dog.name] = dog.dog_id;
    });

    // 插入遛狗请求
    await connection.query(`
      INSERT INTO WalkRequests (dog_id, requested_time, duration_minutes, location, status)
      VALUES
      (?, '2025-06-10 08:00:00', 30, 'Parklands', 'open'),
      (?, '2025-06-10 09:30:00', 45, 'Beachside Ave', 'accepted'),
      (?, '2025-06-11 15:00:00', 60, 'Downtown Park', 'open'),
      (?, '2025-06-12 10:15:00', 40, 'River Trail', 'open'),
      (?, '2025-06-12 16:30:00', 30, 'Hillside Path', 'completed')
    `, [dogMap['Max'], dogMap['Bella'], dogMap['Rocky'], dogMap['Luna'], dogMap['Charlie']]);

    console.log('遛狗请求数据插入成功');

    // 获取walker ID和请求ID
    const [requests] = await connection.query('SELECT request_id, status FROM WalkRequests WHERE status = "accepted" OR status = "completed"');
    const [walkers] = await connection.query('SELECT user_id, username FROM Users WHERE role = "walker"');

    if (requests.length > 0 && walkers.length > 0) {
      // 插入遛狗申请
      await connection.query(`
        INSERT INTO WalkApplications (request_id, walker_id, status)
        VALUES
        (?, ?, 'accepted'),
        (?, ?, 'accepted')
      `, [requests[0].request_id, walkers[0].user_id, requests[1].request_id, walkers[1].user_id]);

      console.log('遛狗申请数据插入成功');

      // 插入评分
      await connection.query(`
        INSERT INTO WalkRatings (request_id, walker_id, owner_id, rating, comments)
        VALUES
        (?, ?, ?, 5, 'Great service!'),
        (?, ?, ?, 4, 'Good walker')
      `, [
        requests[0].request_id, walkers[0].user_id, userMap['carol123'],
        requests[1].request_id, walkers[1].user_id, userMap['alice123']
      ]);

      console.log('评分数据插入成功');
    }

  } catch (err) {
    console.error('测试数据插入失败:', err);
    throw err;
  }
}

// API路由 - 所有狗狗信息
app.get('/api/dogs', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT d.name AS dog_name, d.size, u.username AS owner_username
      FROM Dogs d
      JOIN Users u ON d.owner_id = u.user_id
    `);
    res.json(rows);
  } catch (error) {
    console.error('获取狗狗数据失败:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// API路由 - 开放的遛狗请求
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
    console.error('获取开放遛狗请求失败:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// API路由 - 遛狗者摘要信息
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
    console.error('获取遛狗者摘要信息失败:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 初始化数据库并启动服务器
initializeDatabase().then(() => {
  app.listen(port, () => {
    console.log(`API服务器运行在端口 ${port}`);
  });
}).catch(err => {
  console.error('服务器启动失败:', err);
});