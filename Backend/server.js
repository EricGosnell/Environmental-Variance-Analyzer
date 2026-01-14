const express = require('express');
const path = require('path');

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const xss = require('xss');

const sqlite3 = require('sqlite3').verbose();
const { promisify } = require('util');

const app = express();
const PORT = process.env.PORT || 3000;

//Middleware
app.use(express.static(path.join(__dirname, 'Pages')));
app.use(express.json());

//Database setup
const dbPath = path.join(__dirname, 'db.sqlite');
let db = new sqlite3.Database(dbPath);

const fs = require('fs');

//Helper function to promisify db methods
const promisifyDb = (database) => {
  const dbRun = promisify(database.run.bind(database));
  const dbGet = promisify(database.get.bind(database));
  const dbAll = promisify(database.all.bind(database));
  
  database.run = dbRun;
  database.get = dbGet;
  database.all = dbAll;
  
  return database;
};

db = promisifyDb(db);

//Initialize database from schema file if needed
const initializeDatabase = async () => {
  const dbFilePath = path.join(__dirname, 'db.sqlite');
  let needsInitialization = false;
  
  try {
    // Check if database file exists and is valid
    if (fs.existsSync(dbFilePath)) {
      try {
        // Try to read the file header to verify it's a valid SQLite database
        const buffer = Buffer.alloc(16);
        const fd = fs.openSync(dbFilePath, 'r');
        fs.readSync(fd, buffer, 0, 16, 0);
        fs.closeSync(fd);
        
        // SQLite database files start with "SQLite format 3\0"
        const header = buffer.toString('utf8', 0, 13);
        if (header !== 'SQLite format') {
          console.log('Database file is corrupted (invalid header), will recreate it...');
          needsInitialization = true;
        } else {
          // Try to query to make sure db is accessible
          await db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='users' LIMIT 1");
          console.log('Database already initialized and valid');
          return;
        }
      } catch (error) {
        // Database file exists but is corrupted or inaccessible
        console.log('Database file is corrupted or inaccessible, will recreate it...');
        needsInitialization = true;
      }
    } else {
      // Database doesn't exist, will need to initialize
      console.log('Database file does not exist, will create it...');
      needsInitialization = true;
    }
    
    if (needsInitialization) {
      // Close existing connection
      await new Promise((resolve, reject) => {
        db.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      
      // Delete corrupted file if it exists
      if (fs.existsSync(dbFilePath)) {
        fs.unlinkSync(dbFilePath);
        console.log('Removed corrupted database file');
      }
      
      // Create new database instance
      db = new sqlite3.Database(dbFilePath);
      db = promisifyDb(db);
      
      // Read and execute schema
      console.log('Initializing database from schema...');
      const schema = fs.readFileSync(path.join(__dirname, 'db.sql'), 'utf-8');
      const statements = schema.split(';').filter(stmt => stmt.trim());
      
      for (const statement of statements) {
        if (statement.trim()) {
          await db.run(statement);
        }
      }
      console.log('Database initialized successfully');
    }
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
};

//initialize database tables if they don't exist
const verifyDatabase = async () => {
  try {
    //Verify users table exists and has required columns
    const usersTable = await db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='users'");
    if (!usersTable) {
      console.error('Users table not found in database');
      process.exit(1);
    }
   
    console.log('Database schema verified successfully');
  } catch (error) {
    console.error('Database verification error:', error);
    process.exit(1);
  }
};

//JWT configuration
//TODO: Add real access and refresh tokens
const JWT_CONFIG = {
  accessTokenSecret: process.env.JWT_ACCESS_SECRET || 'temp_dev_access_token_@!3%6BB6',
  refreshTokenSecret: process.env.JWT_REFRESH_SECRET || 'temp_dev_refresh_token_vF54#222',
  //temporary expriy times for dev testing
  accessTokenExpiry: '15m',
  refreshTokenExpiry: '7d'
};

//Utility functions
const generateAccessToken = (user) => {
  return jwt.sign(
    {
      id: user.user_id,
      email: user.email,
      username: user.username
    },
    JWT_CONFIG.accessTokenSecret,
    { expiresIn: JWT_CONFIG.accessTokenExpiry }
  );
};

const generateRefreshToken = (user) => {
  return jwt.sign(
    {
      id: user.user_id,
      email: user.email
    },
    JWT_CONFIG.refreshTokenSecret,
    { expiresIn: JWT_CONFIG.refreshTokenExpiry }
  );
};

//Calculate expiration date for refresh token
const getRefreshTokenExpiry = () => {
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + 7); //Currently set to 7 days from now, see JWT_CONFIG
  return expiryDate.toISOString();
};

//Create refresh tokens table (if it doesn't exist)
const createRefreshTokensTable = async () => {
  try {
    await db.run(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token TEXT UNIQUE NOT NULL,
        user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NOT NULL
      )
    `);
   
    await db.run('CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token)');
    await db.run('CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id)');
    await db.run('CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at)');
   
    console.log('Refresh tokens table ready');
  } catch (error) {
    console.error('Error creating refresh tokens table:', error);
  }
};

//Middleware that helps for protecting the authentication of the routes
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; //Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_CONFIG.accessTokenSecret, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

//Security headers middleware
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

//Input santization schemas for login and registration
const loginValidation = [
  body('username')
    .isLength({ min: 4, max: 12 })
    .withMessage('Username must be between 4 and 12 characters')
    //Regular expression to ensure only alphanumeric, underscores, hyphens - prevent XSS
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Username can only contain letters, numbers, underscores, and hyphens')
    .trim()
    .escape(),
 
  body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters')
];

const registerValidation = [
  body('username')
    .isLength({ min: 4, max: 12 })
    .withMessage('Username must be between 4 and 12 characters')
    //same RegEX logic as in loginValidation
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Username can only contain letters, numbers, underscores, and hyphens')
    .trim()
    .escape(),
 
  body('password')
    //dunno what a good limit on password size is tbh, those google auto generated ones can get long
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
  //Make email and phone number optional since it's not required for login
  body('email')
    .optional()
    .isEmail()
    //funciton auto sanitizes email input
    .normalizeEmail()
    .withMessage('Please provide a valid email address')
    .isLength({ max: 255 })
    .withMessage('Email must be less than 255 characters'),
 
  body('phone_number')
    .optional()
    .isLength({ max: 20 })
    .withMessage('Phone number must be less than 20 characters')
    .matches(/^[+]?[0-9\s\-()]+$/)
    .withMessage('Please provide a valid phone number')
];

//XSS sanitization functions
const sanitizeInput = (input) => {
  if (typeof input === 'string') {
    return xss(input.trim());
  }
  return input;
};

const sanitizeRequestBody = (req, res, next) => {
  if (req.body) {
    Object.keys(req.body).forEach(key => {
      req.body[key] = sanitizeInput(req.body[key]);
    });
  }
  next();
};




//Routes
app.get('/', (req, res) => {
  res.redirect('/home/home.html');
});

//API routes according to API_routes.md, refer to that for details

//POST /auth/login
app.post('/auth/login', sanitizeRequestBody, loginValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array().map(err => ({
          field: err.param,
          message: err.msg
        }))
      });
    }

    const { username, password } = req.body;

    //Find user by username only (from users table)
    const user = await db.get(`
      SELECT u.user_id, u.username, u.password_hash
      FROM users u
      WHERE u.username = ?
    `, [username]);
   
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    //Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    //Get user contact information if available
    const userContact = await db.get(`
      SELECT email, phone_number
      FROM user_contact
      WHERE user_id = ?
    `, [user.user_id]);

    //Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    //Store refresh token
    const expiresAt = getRefreshTokenExpiry();
    await db.run(
      'INSERT INTO refresh_tokens (token, user_id, expires_at) VALUES (?, ?, ?)',
      [refreshToken, user.user_id, expiresAt]
    );

    //Clean up expired refresh tokens
    await db.run('DELETE FROM refresh_tokens WHERE expires_at < datetime("now")');

    //Return response with user info including contact data if available
    const responseUser = {
      id: user.user_id,
      username: user.username,
      email: userContact?.email || null,
      phone_number: userContact?.phone_number || null
    };

    res.json({
      user: responseUser,
      accessToken,
      refreshToken
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

//POST /auth/register
app.post('/auth/register', sanitizeRequestBody, registerValidation, async (req, res) => {
  let transaction = null;
 
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array().map(err => ({
          field: err.param,
          message: err.msg
        }))
      });
    }

    const { username, password, email, phone_number } = req.body;

    //Check if username already exists
    const existingUser = await db.get(`
      SELECT user_id FROM users WHERE username = ?
    `, [username]);
   
    if (existingUser) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    //Check if email already exists (if provided)
    if (email) {
      const existingEmail = await db.get(`
        SELECT user_id FROM user_contact WHERE email = ?
      `, [email]);
     
      if (existingEmail) {
        return res.status(409).json({ error: 'Email already registered' });
      }
    }

    //Start transaction
    await db.run('BEGIN TRANSACTION');
    transaction = true;

    //Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    //Create user in users table
    const userResult = await db.run(
      'INSERT INTO users (username, password_hash) VALUES (?, ?)',
      [username, hashedPassword]
    );

    const userId = userResult.lastID;

    //Create user contact entry if email or phone provided
    //did we want one of these to be required? I think we settled on no but I can't 100% recall
    if (email || phone_number) {
      await db.run(
        'INSERT INTO user_contact (user_id, user_name, email, phone_number) VALUES (?, ?, ?, ?)',
        [userId, username, email || null, phone_number || null]
      );
    }

    //Commit transaction
    await db.run('COMMIT');
    transaction = false;

    //Get the created user with contact info
    const userWithContact = await db.get(`
      SELECT u.user_id, u.username, uc.email, uc.phone_number
      FROM users u
      LEFT JOIN user_contact uc ON u.user_id = uc.user_id
      WHERE u.user_id = ?
    `, [userId]);

    //Generate tokens
    const accessToken = generateAccessToken(userWithContact);
    const refreshToken = generateRefreshToken(userWithContact);

    //Store refresh token
    const expiresAt = getRefreshTokenExpiry();
    await db.run(
      'INSERT INTO refresh_tokens (token, user_id, expires_at) VALUES (?, ?, ?)',
      [refreshToken, userId, expiresAt]
    );

    //Prepare response user object
    const responseUser = {
      id: userWithContact.user_id,
      username: userWithContact.username,
      email: userWithContact.email || null,
      phone_number: userWithContact.phone_number || null
    };

    res.status(201).json({
      user: responseUser,
      accessToken,
      refreshToken
    });

  } catch (error) {
    //not certain if correct way to prevent database errors, will look at again later
    if (transaction) {
      await db.run('ROLLBACK');
    }
   
    console.error('Registration error:', error);
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'Username or email already exists' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

//POST /auth/refresh
app.post('/auth/refresh', [
  body('refreshToken')
    .notEmpty()
    .withMessage('Refresh token is required')
    .isLength({ min: 10, max: 500 })
    .withMessage('Invalid refresh token format')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }

  try {
    const { refreshToken } = req.body;

    //Verify refresh token
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, JWT_CONFIG.refreshTokenSecret);
    } catch (err) {
      return res.status(403).json({ error: 'Invalid refresh token' });
    }

    //Check if refresh token exists and is not expired
    const tokenRecord = await db.get(
      'SELECT * FROM refresh_tokens WHERE token = ? AND expires_at > datetime("now")',
      [refreshToken]
    );

    if (!tokenRecord) {
      return res.status(403).json({ error: 'Refresh token not found or expired' });
    }

    //Find user
    const user = await db.get(`
      SELECT u.user_id, u.username, uc.email
      FROM users u
      LEFT JOIN user_contact uc ON u.user_id = uc.user_id
      WHERE u.user_id = ?
    `, [decoded.id]);
   
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    //Remove old refresh token (rotation)
    await db.run('DELETE FROM refresh_tokens WHERE token = ?', [refreshToken]);

    //Generate new tokens
    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);

    //Store new refresh token
    const expiresAt = getRefreshTokenExpiry();
    await db.run(
      'INSERT INTO refresh_tokens (token, user_id, expires_at) VALUES (?, ?, ?)',
      [newRefreshToken, user.user_id, expiresAt]
    );

    //Clean up expired tokens
    await db.run('DELETE FROM refresh_tokens WHERE expires_at < datetime("now")');

    res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken
    });

  } catch (error) {
    console.error('Refresh error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

//POST /auth/logout
app.post('/auth/logout', [
  body('refreshToken')
    .notEmpty()
    .withMessage('Refresh token is required')
    .isLength({ min: 10, max: 500 })
    .withMessage('Invalid refresh token format')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }

  try {
    const { refreshToken } = req.body;

    await db.run('DELETE FROM refresh_tokens WHERE token = ?', [refreshToken]);

    res.json({ message: 'Logged out successfully' });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

//initialize and start server
initializeDatabase().then(() => {
  return verifyDatabase();
}).then(() => {
  return createRefreshTokensTable();
}).then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Database: ${dbPath}`);
  });
}).catch((error) => {
  console.error('Failed to initialize server:', error);
  process.exit(1);
});

//Graceful shutdown :)
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err);
    } else {
      console.log('Database connection closed');
    }
    process.exit(0);
  });
})

