const express = require('express');
const path = require('path');
const mysql = require('mysql2');
const session = require('express-session');
const bcrypt = require('bcryptjs');


const app = express();
const PORT = process.env.PORT || 3000;

// DB connection
const db = mysql.createConnection({
  host: 'c237-boss.mysql.database.azure.com',
  user: 'c237boss',
  password: 'c237boss!',
  database: 'c237_024_team4'
});

db.connect((err) => {
  if (err) {
    console.error('Database connection error:', err);
    process.exit(1);
  }
  console.log('Connected to SQL database');
});

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'supersecret',
  resave: false,
  saveUninitialized: true
}));
app.set('view engine', 'ejs');

// Routes
app.get('/', (req, res) => {
  res.redirect('/login');
});

app.get('/login', (req, res) => {
  res.render('login', { message: null });
});

app.get('/signup', (req, res) => {
  res.render('signup', { message: null });
});

app.post('/signup', async (req, res) => {
  const { username, password, role } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  db.query('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', 
    [username, hashedPassword, role], 
    (err) => {
      if (err) return res.render('signup', { message: 'Signup failed.' });
      res.redirect('/login');
  });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  db.query('SELECT * FROM users WHERE username = ?', [username], async (err, results) => {
    if (err || results.length === 0) {
      return res.render('login', { message: 'Invalid username or password.' });
    }

    const user = results[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (isMatch) {
      req.session.user = { id: user.id, role: user.role };
      return res.redirect('/dashboard');
    } else {
      return res.render('login', { message: 'Invalid username or password.' });
    }
  });
});

//Temp inventory Route For Testing - Irfan
app.get('/inventory', (req, res) => {
  db.query('SELECT * FROM products', (err, products) => {
    if (err) {
      console.error('Error fetching products:', err);
      return res.status(500).send('Error fetching inventory from database.');
    }
    // Pass both products and the user session object to the template
    res.render('inventory', { 
      products: products, 
      user: req.session.user || null 
    });
  });
});

app.get('/dashboard', (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  res.render('dashboard', { user: req.session.user });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
