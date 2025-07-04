const db = require('./db');

async function initDatabase() {
  try {
    // Create users table
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

    // Create dogs table
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

    // Create walk requests table
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

    // Add test users
    const [existingUsers] = await db.query('SELECT * FROM Users LIMIT 1');
    if (existingUsers.length === 0) {
      // Add first dog owner
      await db.query(`
        INSERT INTO Users (username, email, password_hash, role)
        VALUES ('ownerJane', 'jane@example.com', 'hashedpassword123', 'owner')
      `);

      // Add dog walker
      await db.query(`
        INSERT INTO Users (username, email, password_hash, role)
        VALUES ('walkerMike', 'mike@example.com', 'hashedpassword456', 'walker')
      `);

      // Add second dog owner
      await db.query(`
        INSERT INTO Users (username, email, password_hash, role)
        VALUES ('ownerBob', 'bob@example.com', 'hashedpassword789', 'owner')
      `);

      console.log('Test users created');

      // Get owner IDs
      const [ownerRows] = await db.query('SELECT user_id FROM Users WHERE role = "owner"');

      // Add test dogs for Jane
      await db.query(`
        INSERT INTO Dogs (owner_id, name, breed, size)
        VALUES (?, 'Buddy', 'Golden Retriever', 'large')
      `, [ownerRows[0].user_id]);

      // Add test dogs for Bob
      await db.query(`
        INSERT INTO Dogs (owner_id, name, breed, size)
        VALUES (?, 'Max', 'Beagle', 'medium')
      `, [ownerRows[1].user_id]);

      console.log('Test dogs created');
    }

    console.log('Database initialization complete');
  } catch (error) {
    console.error('Database initialization failed:', error);
  } finally {
    process.exit();
  }
}

initDatabase();