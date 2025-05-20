// signaling-server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" } // Allow CORS for testing
});

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('signal', (data) => {
    console.log('Signal received from', socket.id);
    socket.broadcast.emit('signal', data); // Send to all others
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

server.listen(3000, () => {
  console.log('Socket.IO signaling server running on http://localhost:3000');
});
