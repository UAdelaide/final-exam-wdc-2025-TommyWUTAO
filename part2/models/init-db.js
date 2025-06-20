const db = require('./db');

async function initDatabase() {
  try {
    // 创建用户表
    await db.query(`
      CREATE TABLE IF NOT EXISTS Users (
        user_id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) NOT NULL,
        email VARCHAR(100) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role ENUM('owner', 'walker') NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 创建狗表
    await db.query(`
      CREATE TABLE IF NOT EXISTS Dogs (
        dog_id INT AUTO_INCREMENT PRIMARY KEY,
        owner_id INT NOT NULL,
        name VARCHAR(50) NOT NULL,
        breed VARCHAR(50),
        size ENUM('small', 'medium', 'large') NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (owner_id) REFERENCES Users(user_id)
      )
    `);

    // 创建步行请求表
    await db.query(`
      CREATE TABLE IF NOT EXISTS WalkRequests (
        request_id INT AUTO_INCREMENT PRIMARY KEY,
        dog_id INT NOT NULL,
        walker_id INT,
        requested_time DATETIME NOT NULL,
        duration_minutes INT NOT NULL,
        location VARCHAR(255) NOT NULL,
        status ENUM('pending', 'accepted', 'completed', 'cancelled') DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (dog_id) REFERENCES Dogs(dog_id),
        FOREIGN KEY (walker_id) REFERENCES Users(user_id)
      )
    `);

    // 添加测试用户
    const [existingUsers] = await db.query('SELECT * FROM Users LIMIT 1');
    if (existingUsers.length === 0) {
      // 添加狗主人
      await db.query(`
        INSERT INTO Users (username, email, password_hash, role)
        VALUES ('testowner', 'owner@example.com', 'password123', 'owner')
      `);

      // 添加遛狗人
      await db.query(`
        INSERT INTO Users (username, email, password_hash, role)
        VALUES ('testwalker', 'walker@example.com', 'password123', 'walker')
      `);

      console.log('测试用户已创建');

      // 获取狗主人ID
      const [ownerRow] = await db.query('SELECT user_id FROM Users WHERE role = "owner" LIMIT 1');
      const ownerId = ownerRow[0].user_id;

      // 添加测试狗
      await db.query(`
        INSERT INTO Dogs (owner_id, name, breed, size)
        VALUES (?, 'Buddy', 'Golden Retriever', 'large')
      `, [ownerId]);

      await db.query(`
        INSERT INTO Dogs (owner_id, name, breed, size)
        VALUES (?, 'Max', 'Beagle', 'medium')
      `, [ownerId]);

      console.log('测试狗已创建');
    }

    console.log('数据库初始化完成');
  } catch (error) {
    console.error('数据库初始化失败:', error);
  } finally {
    process.exit();
  }
}

initDatabase();