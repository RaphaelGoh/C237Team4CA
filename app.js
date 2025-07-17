const express = require('express');
const path = require('path');
const mysql = require('mysql2'); // Add mysql2 for SQL connection

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON
app.use(express.json());

// Serve static files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Create SQL database connection
const db = mysql.createConnection({
  host: 'localhost',
  user: 'your_username',     // replace with your DB username
  password: 'your_password', // replace with your DB password
  database: 'your_database'  // replace with your DB name
});

// Connect to the database
db.connect((err) => {
  if (err) {
    console.error('Error connecting to the database:', err);
    process.exit(1);
  }
  console.log('Connected to the SQL database.');
});

// Homepage route
app.get('/', (req, res) => {
  res.send('Welcome to the homepage!');
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${3000}`);
});
