const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.static(path.join(__dirname, 'public')));

const rooms = new Map();
function roomState(code) {
  if (!rooms.has(code)) rooms.set(code, { host: null, users: new Map(), playing: false, time: 0, updated: Date.now() });
  return rooms.get(code);
}
function members(code) {
  const r = rooms.get(code);
  return r ? [...r.users.values()] : [];
}
io.on('connection', socket => {
  socket.on('join-room', ({ code, name, avatar }) => {
    code = String(code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    name = String(name || '').trim().slice(0, 24);
    if (!code || !name) return socket.emit('error-msg', 'Digite um código e seu nome.');
    if (socket.rooms.size > 1) return;
    const r = roomState(code);
    socket.join(code);
    socket.data.code = code;
    socket.data.name = name;
    socket.data.avatar = avatar || '';
    if (!r.host) r.host = socket.id;
    r.users.set(socket.id, { id: socket.id, name, avatar: avatar || '', host: socket.id === r.host });
    socket.emit('joined', { code, host: socket.id === r.host, state: { playing: r.playing, time: r.time, updated: r.updated } });
    io.to(code).emit('users', members(code));
    socket.to(code).emit('chat', { name: 'Watch Together', text: `${name} entrou na sala.`, system: true });
  });
  socket.on('sync', data => {
    const code = socket.data.code; if (!code) return;
    const r = rooms.get(code);
    if (r.host !== socket.id) return;
    r.playing = !!data.playing;
    r.time = Math.max(0, Number(data.time) || 0);
    r.updated = Date.now();
    socket.to(code).emit('sync', { playing: r.playing, time: r.time, updated: r.updated, action: data.action });
  });
  socket.on('chat-message', text => {
    const code = socket.data.code; if (!code) return;
    text = String(text || '').trim().slice(0, 500);
    if (!text) return;
    io.to(code).emit('chat', { name: socket.data.name, text });
  });
  socket.on('disconnect', () => {
    const code = socket.data.code; if (!code) return;
    const r = rooms.get(code); if (!r) return;
    r.users.delete(socket.id);
    if (r.host === socket.id) {
      r.host = r.users.keys().next().value || null;
      if (r.host) r.users.get(r.host).host = true;
    }
    io.to(code).emit('users', members(code));
    if (!r.users.size) rooms.delete(code);
  });
});
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Watch Together running on port ' + PORT));
