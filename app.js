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

// Middleware to check if user is admin
const checkAdmin = (req, res, next) => {
    if (req.session.user.role === 'admin') {
        return next();
    } else {
        req.flash('error', 'Access denied');
        res.redirect('/shopping');
    }
};

// Routes
app.get('/',  (req, res) => {
    res.render('index', {user: req.session.user} );
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

//Inventory Route (Test)- Irfan
app.get('/inventory',checkAdmin, (req, res) => {
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


//UpdateProduct Route (Edit Inventory) - Irfan (NOT FINISHED)
//app.get('/updateProduct/:id', upload.single('image'), (req, res) => {
//const productId = req.params.id;
//  const sql = 'SELECT * FROM products WHERE productId = ?';

    // Fetch data from MySQL based on the product ID
//  connection.query(sql , [productId], (error, results) => {
//    if (error) throw error;

        // Check if any product with the given ID was found
//        if (results.length > 0) {
            // Render HTML page with the product data
//            res.render('updateProduct', { product: results[0] });
//        } else {
            // If no product with the given ID was found, render a 404 page or handle it accordingly
//            res.status(404).send('Product not found');
//        }
//    });
//});
//app.post('/updateProduct/:id', (req, res) => {


//DeleteProduct Route (Delete Inventory) - Irfan (NOT FINISHED)
//app.get('/deleteProduct/:id', (req, res) => {




app.get('/dashboard', (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  res.render('dashboard', { user: req.session.user });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
