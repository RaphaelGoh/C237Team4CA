const express = require('express');
const path = require('path');
const mysql = require('mysql2');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

// Multer setup for image upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'public/images'),
  filename: (req, file, cb) => cb(null, file.originalname)
});
const upload = multer({ storage });

// DB Connection
const db = mysql.createConnection({
  host: 'c237-boss.mysql.database.azure.com',
  user: 'c237boss',
  password: 'c237boss!',
  database: 'c237_024_team4'
});

db.connect(err => {
  if (err) {
    console.error('❌ Database connection failed:', err);
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
  saveUninitialized: true,
  cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 }
}));
app.set('view engine', 'ejs');

// Authentication Middleware
const checkAuthenticated = (req, res, next) => {
  if (req.session.user) return next();
  res.redirect('/login');
};

const checkAdmin = (req, res, next) => {
  if (req.session.user && req.session.user.role === 'admin') return next();
  res.redirect('/dashboard');
};

// Routes
app.get('/', (req, res) => res.redirect('/login'));

// Login
app.get('/login', (req, res) => {
  res.render('login', { message: null });
});

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
      return res.redirect(user.role === 'admin' ? '/admin-dashboard' : '/menu');
    }

    res.render('login', { message: 'Invalid email or password.' });
  });
});

// Signup
app.get('/signup', (req, res) => {
  res.render('signup', { message: null });
});

app.post('/signup', async (req, res) => {
  const { username, email, password, address, contact, role } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const sql = `
    INSERT INTO users (username, email, password, address, contact, role)
    VALUES (?, ?, ?, ?, ?, ?)
  `;
  db.query(sql, [username, email, hashedPassword, address, contact, role], err => {
    if (err) {
      console.error('Signup error:', err);
      return res.render('signup', { message: 'Signup failed.' });
    }
    res.redirect('/login');
  });
});

// Dashboards
app.get('/dashboard', checkAuthenticated, (req, res) => {
  res.render('dashboard', { user: req.session.user });
});

app.get('/admin-dashboard', checkAuthenticated, checkAdmin, (req, res) => {
  db.query('SELECT * FROM products', (err, products) => {
    if (err) return res.status(500).send('Failed to load products.');
    res.render('admin-dashboard', { user: req.session.user, products });
  });
});

app.get('/user-dashboard', checkAuthenticated, (req, res) => {
  if (req.session.user.role !== 'user') return res.redirect('/dashboard');
  res.render('user-dashboard', { user: req.session.user });
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// Inventory
app.get('/inventory', checkAuthenticated, (req, res) => {
  db.query('SELECT * FROM products', (err, products) => {
    if (err) return res.status(500).send('Database error.');
    res.render('inventory', { products, user: req.session.user });
  });
});

// Add Product
app.get('/addProduct', checkAuthenticated, checkAdmin, (req, res) => {
  res.render('addProduct', { user: req.session.user });
});

app.post('/addProduct', checkAuthenticated, checkAdmin, upload.single('image'), (req, res) => {
  const { name, quantity, price, category } = req.body;
  const image = req.file ? req.file.filename : null;

  const sql = 'INSERT INTO products (productName, quantity, price, image, category) VALUES (?, ?, ?, ?, ?)';
  db.query(sql, [name, quantity, price, image, category], err => {
    if (err) {
      console.error('Error adding product:', err);
      return res.status(500).send('Insert failed.');
    }
    res.redirect('/inventory');
  });
});

// Edit Product
app.get('/editProduct/:id', checkAuthenticated, checkAdmin, (req, res) => {
  const sql = 'SELECT * FROM products WHERE productId = ?';
  db.query(sql, [req.params.id], (err, results) => {
    if (err || results.length === 0) return res.status(500).send('Product not found.');
    res.render('editProduct', { product: results[0], user: req.session.user });
  });
});

app.post('/editProduct/:id', checkAuthenticated, checkAdmin, upload.single('image'), (req, res) => {
  const { name, quantity, price, category } = req.body;
  const productId = req.params.id;
  const image = req.file ? req.file.filename : null;

  const sql = image
    ? 'UPDATE products SET productName = ?, quantity = ?, price = ?, image = ?, category = ? WHERE productId = ?'
    : 'UPDATE products SET productName = ?, quantity = ?, price = ?, category = ? WHERE productId = ?';

  const values = image
    ? [name, quantity, price, image, category, productId]
    : [name, quantity, price, category, productId];

  db.query(sql, values, err => {
    if (err) return res.status(500).send('Failed to update product.');
    res.redirect('/admin-dashboard');
  });
});

// Delete Product
app.get('/deleteProduct/:id', checkAuthenticated, checkAdmin, (req, res) => {
  db.query('DELETE FROM products WHERE productId = ?', [req.params.id], err => {
    if (err) return res.status(500).send('Failed to delete product.');
    res.redirect('/admin-dashboard');
  });
});

// Menu
app.get('/menu', checkAuthenticated, (req, res) => {
  db.query('SELECT * FROM products', (err, products) => {
    if (err) return res.status(500).send('Failed to load products.');
    res.render('menu', { user: req.session.user, products });
  });
});

// Search
app.post('/search', checkAuthenticated, (req, res) => {
  const searchTerm = `%${req.body.searchTerm}%`;
  db.query(
    'SELECT * FROM products WHERE productName LIKE ? OR description LIKE ?',
    [searchTerm, searchTerm],
    (err, results) => {
      if (err) return res.status(500).send('Error searching products.');
      res.render('menu', { user: req.session.user, products: results });
    }
  );
});

app.get('/api/search', (req, res) => {
  const sql = `SELECT productId, productName FROM products WHERE productName LIKE ? LIMIT 5`;
  db.query(sql, [`${req.query.term}%`], (err, results) => {
    if (err) return res.status(500).json([]);
    res.json(results);
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Gangnam Spice running at http://localhost:${PORT}`);
});
