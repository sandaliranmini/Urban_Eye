const express = require('express');
const http = require('http');                       
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();
const db = require('./config/db');
const { initSocket } = require('./config/socket');   

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Health check
app.get('/api/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Start server  (REPLACED the old app.listen block)
const PORT = process.env.PORT || 5000;
const server = http.createServer(app);              
initSocket(server);                                

server.listen(PORT, () => {                           // CHANGED: server.listen instead of app.listen
  console.log(`Server running on http://localhost:${PORT}`);
});