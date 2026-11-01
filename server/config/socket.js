const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

let io;

function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL,
      methods: ['GET', 'POST'],
    },
  });

  // Authenticate every connection with the same JWT used by the REST API
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Authentication required'));
      socket.user = jwt.verify(token, process.env.JWT_SECRET);
      next();
    } catch (err) {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    const { role, wardId } = socket.user;

    // Officers/admins get the emergency room; everyone gets their ward room
    if (role === 'officer' || role === 'admin') socket.join('officers');
    if (wardId) socket.join(`ward:${wardId}`);

    console.log(`Socket connected: ${socket.id} (${role})`);
    socket.on('disconnect', () => console.log(`Socket disconnected: ${socket.id}`));
  });

  return io;
}

function getIO() {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
}

// Helpers other modules will call
const emitEmergencyAlert = (payload) => getIO().to('officers').emit('emergency:new', payload);
const emitWardAnnouncement = (wardId, payload) =>
  getIO().to(`ward:${wardId}`).emit('announcement:new', payload);

module.exports = { initSocket, getIO, emitEmergencyAlert, emitWardAnnouncement };