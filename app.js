const express = require('express');
const path = require('path');
const mysql = require('mysql2');
const session = require('express-session');
const bcrypt = require('bcrypt');

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to MySQL
const db = mysql.createConnection({
  host: 'c237-boss.mysql.database.azure.com',
  user: 'c237boss',
  password: 'c237boss!',
  database: 'c237_024_team4'
});

db.connect((err) => {
  if (err) {
    console.error('Database connection failed:', err);
    process.exit(1);
  }
  console.log('✅ Connected to MySQL Database');
});

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'gangnam-spice-secret',
  resave: false,
  saveUninitialized: true
}));
app.set('view engine', 'ejs');

// Homepage → redirect to login
app.get('/', (req, res) => {
  res.redirect('/login');
});

// Render Login Page
app.get('/login', (req, res) => {
  res.render('login', { message: null });
});

// Render Signup Page
app.get('/signup', (req, res) => {
  res.render('signup', { message: null });
});

// Handle Signup
app.post('/signup', async (req, res) => {
  const { username, email, password, address, contact, role } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const sql = `
      INSERT INTO users (username, email, password, address, contact, role)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    db.query(sql, [username, email, hashedPassword, address, contact, role], (err, result) => {
      if (err) {
        console.error('Signup error:', err);
        return res.render('signup', { message: 'Signup failed. Please try again.' });
      }
      res.redirect('/login');
    });
  } catch (error) {
    console.error('Hashing error:', error);
    res.render('signup', { message: 'Error processing password.' });
  }
});

// Handle Login
app.post('/login', (req, res) => {
  const { email, password } = req.body;

  const sql = 'SELECT * FROM users WHERE email = ?';
  db.query(sql, [email], async (err, results) => {
    if (err || results.length === 0) {
      return res.render('login', { message: 'Invalid email or password.' });
    }

    const user = results[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (isMatch) {
      req.session.user = {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      };
      res.redirect('/dashboard');
    } else {
      res.render('login', { message: 'Invalid email or password.' });
    }
  });
});

// Dashboard (protected)
app.get('/dashboard', (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  res.render('dashboard', { user: req.session.user });
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Gangnam Spice running at http://localhost:${PORT}`);
});
