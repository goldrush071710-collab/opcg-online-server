const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

const rooms = {};

io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);

    // Create a new room
    socket.on('create_room', (callback) => {
        const roomId = Math.random().toString(36).substring(2, 6).toUpperCase();
        rooms[roomId] = { p1: socket.id, p2: null, p1Ready: false, p2Ready: false };
        socket.join(roomId);
        socket.roomId = roomId;
        callback({ success: true, roomId: roomId });
    });

    // Join an existing room
    socket.on('join_room', (roomId, callback) => {
        roomId = roomId.toUpperCase();
        if (rooms[roomId] && !rooms[roomId].p2) {
            rooms[roomId].p2 = socket.id;
            socket.join(roomId);
            socket.roomId = roomId;
            callback({ success: true });
        } else {
            callback({ success: false, msg: 'Room is full or does not exist.' });
        }
    });

    // Player selects deck and is ready
    socket.on('deck_selected', (deckName) => {
        const room = rooms[socket.roomId];
        if(!room) return;

        if (room.p1 === socket.id) room.p1Ready = true;
        if (room.p2 === socket.id) room.p2Ready = true;

        // If both are ready, start the game and decide who goes first randomly
        if (room.p1Ready && room.p2Ready) {
            const p1GoesFirst = Math.random() > 0.5;
            io.to(room.p1).emit('game_start', { isFirst: p1GoesFirst });
            io.to(room.p2).emit('game_start', { isFirst: !p1GoesFirst });
        }
    });

    // Sync board movements to the other player
    socket.on('board_update', (boardState) => {
        if(socket.roomId) {
            socket.to(socket.roomId).emit('opponent_board_update', boardState);
        }
    });

    socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);
        if(socket.roomId && rooms[socket.roomId]) {
            socket.to(socket.roomId).emit('opponent_disconnected');
            delete rooms[socket.roomId]; // Close the room if someone leaves
        }
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server is running! Open http://localhost:${PORT} in your browser.`);
});
