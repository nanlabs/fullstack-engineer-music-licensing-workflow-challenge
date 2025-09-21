const io = require('socket.io-client');

// Simple Node.js WebSocket client for testing
const socket = io('http://localhost:3001', {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

socket.on('connect', () => {
  console.log('✅ Connected to WebSocket server');
  console.log('Socket ID:', socket.id);
});

socket.on('disconnect', (reason) => {
  console.log('❌ Disconnected from WebSocket server');
  console.log('Reason:', reason);
});

socket.on('connect_error', (error) => {
  console.log('🚫 Connection error:', error.message);
});

// Listen for license status updates
socket.on('licenseStatusUpdate', (data) => {
  console.log('🔄 License Status Update:', JSON.stringify(data, null, 2));
});

// Listen for track creation events
socket.on('trackCreated', (data) => {
  console.log('🎵 Track Created:', JSON.stringify(data, null, 2));
});

// Listen for movie statistics updates
socket.on('movieStatisticsUpdate', (data) => {
  console.log('📊 Movie Statistics Update:', JSON.stringify(data, null, 2));
});

// Listen for any other events
socket.onAny((eventName, ...args) => {
  if (!['connect', 'disconnect', 'connect_error', 'licenseStatusUpdate', 'trackCreated', 'movieStatisticsUpdate'].includes(eventName)) {
    console.log('📡 Unknown Event:', eventName, args);
  }
});

// Keep the process running
process.on('SIGINT', () => {
  console.log('\n👋 Disconnecting...');
  socket.disconnect();
  process.exit(0);
});

console.log('🔌 Attempting to connect to WebSocket server at http://localhost:3001');
console.log('Press Ctrl+C to disconnect and exit');
