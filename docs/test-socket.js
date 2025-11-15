const s = document.createElement('script');
s.src = 'https://cdn.socket.io/4.7.5/socket.io.min.js';
s.onload = () => {
  console.log('socket.io-client loaded');

  const socket = io('http://localhost:3000/licensing', {
    transports: ['websocket'],
  });

  socket.on('connect', () => {
    console.log('WS connected, id:', socket.id);

    const sceneId = 'cc8b7b6c-3c1a-4c39-b4ef-839b69c21eab'; //Here you can use other scene id
    socket.emit('joinScene', sceneId);
    console.log('joined scene', sceneId);
  });

  socket.on('connect_error', (err) => {
    console.error('WS connect_error:', err.message);
  });

  socket.on('trackStatusUpdated', (data) => {
    console.log('WS trackStatusUpdated:', data);
  });
};
document.head.appendChild(s);
