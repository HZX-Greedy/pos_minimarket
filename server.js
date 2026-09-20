require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from public and root
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

// Fallback for HTML pages
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log('====================================================');
  console.log('   SISTEM POS MINIMARKET & RETAIL (OFFLINE-FIRST)');
  console.log(`   Akses Web: http://localhost:${PORT}`);
  console.log('   Penyimpanan: IndexedDB & LocalStorage (100% Mandiri)');
  console.log('====================================================');
});
