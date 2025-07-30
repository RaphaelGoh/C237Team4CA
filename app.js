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
        role: user.role,
        address: user.address,
        contact: user.contact
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
    if (err) {
      console.error('Failed to load products:', err);
      return res.status(500).send('Failed to load products.');
    }

    console.log('Products fetched:', products); // Debugging output
    res.render('menu', { user: req.session.user, products });
  });
});

// Search
app.post('/search', checkAuthenticated, (req, res) => {
  const searchTerm = `%${req.body.searchTerm}%`;
  console.log('Search term:', req.body.searchTerm); 

  db.query(
  'SELECT * FROM products WHERE productName LIKE ?',
  [searchTerm],
  (err, results) => {
    if (err) {
      console.error('DB error:', err);
      return res.status(500).send('Error searching products.');
    }
    res.render('searchResults', {
      user: req.session.user,
      searchTerm: req.body.searchTerm,
      products: results
    });
  }
);
});
// Checkout
app.get('/checkout', (req, res) => {
  const cart = req.session.cart || []; // adjust based on your session handling
  const user = req.session.user;
  console.log("Checkout user:", user);
  res.render('checkout', { cart, user });

});

// Confirm Order
app.get('/confirm', (req, res) => {
  res.render('confirm'); // Make sure you have confirm.ejs in your views folder
});

app.post('/confirm', checkAuthenticated, (req, res) => {
  const { cardNumber } = req.body;
  const cart = req.session.cart || [];
  const user = req.session.user;

  if (!cardNumber || cart.length === 0) {
    return res.status(400).send('Invalid order.');
  }

  req.session.cart = [];  // clear the cart after confirmation

  res.render('confirm', {
    user,
    message: 'Thank you for your purchase!',
    cardNumber
  });
});


// Product Details
app.get('/product/:id', (req, res) => {
  const productId = req.params.id;
  const query = 'SELECT * FROM products WHERE productid = ?';
  
  db.query(query, [productId], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Database error.');
    }
    if (results.length === 0) {
      return res.status(404).send('Product not found.');
    }
    res.render('product', { product: results[0], user: req.session.user });
  });
});
// CONTACT US
app.get('/contact', (req, res) => {
    // temp null message
    res.render('contact', { message: null });
});

app.post('/contact', (req, res) => {
    const { name, email, number, message } = req.body;
    const query = 'INSERT INTO messages (name, email, number, message) VALUES (?, ?, ?, ?)';

    db.query(query, [name, email, number, message], (err, result) => {
        if (err) {
            console.error('Error saving message:', err);
            return res.render('contact', { message: 'Sorry, there was an error sending your message.' });
        }
        res.render('contact', { message: 'Thank you for your message! We will get back to you soon.' });
    });
});

// ADMIN MESSAGES
app.get('/admin-messages', checkAuthenticated, checkAdmin, (req, res) => {
    const query = 'SELECT * FROM messages ORDER BY messageId';

    db.query(query, (err, messages) => {
        if (err) {
            console.error('Error fetching messages:', err);
            return res.status(500).send('Error fetching messages from database.');
        }
        res.render('admin-messages', { 
            messages: messages, 
            user: req.session.user 
        });
    });
});

app.get('/admin-messages/delete/:id', checkAuthenticated, checkAdmin, (req, res) => {
    const messageId = req.params.id;
    const query = 'DELETE FROM messages WHERE messageId = ?';

    db.query(query, [messageId], (err, result) => {
        if (err) {
            console.error('Error deleting message:', err);
        }
        res.redirect('/admin-messages');
    });
});


// Cart - Display cart items
app.get('/cart', checkAuthenticated, (req, res) => {
  const userId = req.session.user.id;

  db.query('SELECT id FROM carts WHERE user_id = ?', [userId], (err, cartRows) => {
    if (err) {
      console.error('Error fetching cart:', err);
      return res.status(500).send('Database error.');
    }

    if (cartRows.length === 0) return res.render('cart', { cart: [] });

    const cartId = cartRows[0].id;

    db.query(
      `SELECT ci.product_id, ci.quantity, p.productName, p.price, p.image
       FROM cart_items ci
       JOIN products p ON ci.product_id = p.productId
       WHERE ci.cart_id = ?`,
      [cartId],
      (err, items) => {
        if (err) {
          console.error('Error fetching cart items:', err);
          return res.status(500).send('Database error.');
        }
        res.render('cart', { cart: items });
      }
    );
  });
});

// Add to Cart
app.post('/cart/add/:id', checkAuthenticated, (req, res) => {
  const productId = parseInt(req.params.id);
  const userId = req.session.user.id;

  db.query('SELECT id FROM carts WHERE user_id = ?', [userId], (err, cartRows) => {
    if (err) return res.status(500).send('Database error.');

    if (cartRows.length === 0) {
      db.query('INSERT INTO carts (user_id) VALUES (?)', [userId], (err, result) => {
        if (err) return res.status(500).send('Failed to create cart.');
        const cartId = result.insertId;
        insertOrUpdateCartItem(cartId);
      });
    } else {
      const cartId = cartRows[0].id;
      insertOrUpdateCartItem(cartId);
    }

    function insertOrUpdateCartItem(cartId) {
      db.query(
        'SELECT quantity FROM cart_items WHERE cart_id = ? AND product_id = ?',
        [cartId, productId],
        (err, rows) => {
          if (err) return res.status(500).send('Error checking cart.');

          if (rows.length > 0) {
            const newQty = rows[0].quantity + 1;
            db.query(
              'UPDATE cart_items SET quantity = ? WHERE cart_id = ? AND product_id = ?',
              [newQty, cartId, productId],
              err => {
                if (err) return res.status(500).send('Failed to update cart.');
                res.redirect('/cart');
              }
            );
          } else {
            db.query(
              'INSERT INTO cart_items (cart_id, product_id, quantity) VALUES (?, ?, 1)',
              [cartId, productId],
              err => {
                if (err) return res.status(500).send('Failed to add item to cart.');
                res.redirect('/cart');
              }
            );
          }
        }
      );
    }
  });
});

// Edit Cart Quantities
app.post('/cart/edit', checkAuthenticated, (req, res) => {
  const { productIds, quantities } = req.body;
  const userId = req.session.user.id;

  if (!productIds || !quantities) return res.redirect('/cart');

  const ids = Array.isArray(productIds) ? productIds : [productIds];
  const qtys = Array.isArray(quantities) ? quantities : [quantities];

  db.query('SELECT id FROM carts WHERE user_id = ?', [userId], (err, cartRows) => {
    if (err || cartRows.length === 0) return res.redirect('/cart');
    const cartId = cartRows[0].id;

    ids.forEach((productId, i) => {
      const qty = parseInt(qtys[i]);
      if (qty > 0) {
        db.query(
          'UPDATE cart_items SET quantity = ? WHERE cart_id = ? AND product_id = ?',
          [qty, cartId, productId],
          err => {
            if (err) console.error('Failed to update quantity for productId', productId);
          }
        );
      }
    });

    res.redirect('/cart');
  });
});

// Delete Cart Item
app.get('/cart/delete/:id', checkAuthenticated, (req, res) => {
  const userId = req.session.user.id;
  const productId = parseInt(req.params.id);

  db.query('SELECT id FROM carts WHERE user_id = ?', [userId], (err, cartRows) => {
    if (err || cartRows.length === 0) return res.redirect('/cart');
    const cartId = cartRows[0].id;

    db.query(
      'DELETE FROM cart_items WHERE cart_id = ? AND product_id = ?',
      [cartId, productId],
      err => {
        if (err) console.error('Delete failed:', err);
        res.redirect('/cart');
      }
    );
  });
});




// ADMIN MESSAGES
app.get('/admin-messages', checkAuthenticated, checkAdmin, (req, res) => {
    const query = 'SELECT * FROM messages ORDER BY messageId';

    db.query(query, (err, messages) => {
        if (err) {
            console.error('Error fetching messages:', err);
            return res.status(500).send('Error fetching messages from database.');
        }
        res.render('admin-messages', { 
            messages: messages, 
            user: req.session.user 
        });
    });
});

app.get('/admin-messages/delete/:id', checkAuthenticated, checkAdmin, (req, res) => {
    const messageId = req.params.id;
    const query = 'DELETE FROM messages WHERE messageId = ?';

    db.query(query, [messageId], (err, result) => {
        if (err) {
            console.error('Error deleting message:', err);
        }
        res.redirect('/admin-messages');
    });
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Gangnam Spice running at http://localhost:${PORT}`);
});
