const express = require('express');
const http = require('http'); 
const { initSocket } = require('./config/socket');                      
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();
const db = require('./config/db');
const { startAutoCloseJob } = require('./cron/autoCloseTickets');
const app = express();

process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
  process.exit(1);
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// API Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/wards', require('./routes/wards'));
app.use('/api/issues', require('./routes/issueRoutes'));
app.use('/api/resolutions', require('./routes/resolutionRoutes'));
app.use('/api/audit-logs', require('./routes/auditRoutes'));
app.use('/api/announcements', require('./routes/announcementRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));

app.get('/api/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch (err) {
    console.error('Health check error:', err);
    res.status(500).json({ status: 'error', code: err.code, message: err.message });
  }
});

// 404 & Error handlers (must come AFTER all routes)
const { notFound, errorHandler } = require('./middleware/errorMiddleware');
app.use(notFound);
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 5000;
const server = http.createServer(app);              
initSocket(server);                                

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  startAutoCloseJob();
});
