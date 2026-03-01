const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

const rooms = {};
let waitingPlayer = null; 

io.on('connection', (socket) => {
    socket.on('create_room', (callback) => {
        const roomId = Math.random().toString(36).substring(2, 6).toUpperCase();
        rooms[roomId] = { p1: socket.id, p2: null, p1Ready: false, p2Ready: false, p1Mulligan: false, p2Mulligan: false };
        socket.join(roomId);
        socket.roomId = roomId;
        callback({ success: true, roomId: roomId });
    });

    socket.on('join_room', (roomId, callback) => {
        roomId = roomId.toUpperCase();
        if (rooms[roomId] && !rooms[roomId].p2) {
            rooms[roomId].p2 = socket.id;
            socket.join(roomId);
            socket.roomId = roomId;
            io.to(roomId).emit('player_joined');
            callback({ success: true });
        } else {
            callback({ success: false, msg: 'Room full or invalid.' });
        }
    });

    socket.on('join_random', (callback) => {
        if (waitingPlayer && rooms[waitingPlayer.roomId] && !rooms[waitingPlayer.roomId].p2) {
            const roomId = waitingPlayer.roomId;
            rooms[roomId].p2 = socket.id;
            socket.join(roomId);
            socket.roomId = roomId;
            waitingPlayer = null; 
            io.to(roomId).emit('player_joined');
            callback({ success: true, roomId: roomId, waiting: false });
        } else {
            const roomId = Math.random().toString(36).substring(2, 6).toUpperCase();
            rooms[roomId] = { p1: socket.id, p2: null, p1Ready: false, p2Ready: false, p1Mulligan: false, p2Mulligan: false };
            socket.join(roomId);
            socket.roomId = roomId;
            waitingPlayer = { id: socket.id, roomId: roomId };
            callback({ success: true, roomId: roomId, waiting: true });
        }
    });

    socket.on('deck_selected', () => {
        const room = rooms[socket.roomId];
        if(!room) return;
        if (room.p1 === socket.id) room.p1Ready = true;
        if (room.p2 === socket.id) room.p2Ready = true;

        if (room.p1Ready && room.p2Ready) {
            const p1GoesFirst = Math.random() > 0.5;
            io.to(room.p1).emit('game_start', { isFirst: p1GoesFirst });
            io.to(room.p2).emit('game_start', { isFirst: !p1GoesFirst });
        }
    });

    // MULLIGAN SYNC
    socket.on('mulligan_done', () => {
        const room = rooms[socket.roomId];
        if(!room) return;
        if (room.p1 === socket.id) room.p1Mulligan = true;
        if (room.p2 === socket.id) room.p2Mulligan = true;

        if (room.p1Mulligan && room.p2Mulligan) {
            io.to(room.p1).emit('begin_game');
            io.to(room.p2).emit('begin_game');
        }
    });

    socket.on('board_update', (boardState) => {
        if(socket.roomId) socket.to(socket.roomId).emit('opponent_board_update', boardState);
    });

    socket.on('pass_turn', () => {
        if(socket.roomId) socket.to(socket.roomId).emit('turn_passed');
    });

    socket.on('chat_msg', (msg) => {
        if(socket.roomId) socket.to(socket.roomId).emit('chat_msg', msg);
    });

    socket.on('game_action', (data) => {
        if(socket.roomId) socket.to(socket.roomId).emit('game_action', data);
    });

    socket.on('disconnect', () => {
        if (waitingPlayer && waitingPlayer.id === socket.id) waitingPlayer = null;
        if(socket.roomId && rooms[socket.roomId]) {
            socket.to(socket.roomId).emit('opponent_disconnected');
            delete rooms[socket.roomId];
        }
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`Server Live!`));
