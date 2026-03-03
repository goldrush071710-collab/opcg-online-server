const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path'); // <-- Added the path module

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve your static files
app.use(express.static(__dirname));

// BULLETPROOF ROUTE: Forces the server to load your index.html when you open the link!
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});


// --- SERVER STATE ---
const rooms = {};
let waitingPlayer = null;

// The Global Alignment System: This holds the perfect coordinates for everyone!
let globalAlignment = {}; 

// --- HELPER FUNCTION ---
function generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let code = '';
    for(let i=0; i<4; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    return code;
}

// --- SOCKET.IO CONNECTIONS ---
io.on('connection', (socket) => {
    console.log('A player connected:', socket.id);

    // 1. Instantly send the Global Alignment to any new player who connects
    socket.emit('global_align_update', globalAlignment);

    // 2. Listen for when YOU use the 717 Tool to save new alignments
    socket.on('set_global_align', (data) => {
        globalAlignment = data; // Save it to the server's memory
        io.emit('global_align_update', globalAlignment); // Broadcast it to everyone online
        console.log("Global Alignment Updated!");
    });

    // --- MATCHMAKING & LOBBIES ---
    socket.on('create_room', (callback) => {
        let roomId = generateRoomCode();
        while(rooms[roomId]) roomId = generateRoomCode(); // Ensure unique code
        
        rooms[roomId] = {
            players: [socket.id],
            ready: 0
        };
        socket.join(roomId);
        socket.roomId = roomId;
        callback({ roomId });
    });

    socket.on('join_room', (roomId, callback) => {
        roomId = roomId.toUpperCase();
        if (rooms[roomId] && rooms[roomId].players.length === 1) {
            rooms[roomId].players.push(socket.id);
            socket.join(roomId);
            socket.roomId = roomId;
            socket.to(roomId).emit('player_joined');
            callback({ success: true });
            
            // Randomly decide who goes first
            const p1GoesFirst = Math.random() >= 0.5;
            io.to(rooms[roomId].players[0]).emit('game_start', { isFirst: p1GoesFirst });
            io.to(rooms[roomId].players[1]).emit('game_start', { isFirst: !p1GoesFirst });
        } else {
            callback({ success: false });
        }
    });

    socket.on('join_random', (callback) => {
        if (waitingPlayer && waitingPlayer.id !== socket.id) {
            // Found a waiting player! Join their room.
            let roomId = waitingPlayer.roomId;
            if(rooms[roomId]) {
                rooms[roomId].players.push(socket.id);
                socket.join(roomId);
                socket.roomId = roomId;
                socket.to(roomId).emit('player_joined');
                waitingPlayer = null; // Clear the queue
                callback({ roomId: roomId, waiting: false });

                // Randomly decide who goes first
                const p1GoesFirst = Math.random() >= 0.5;
                io.to(rooms[roomId].players[0]).emit('game_start', { isFirst: p1GoesFirst });
                io.to(rooms[roomId].players[1]).emit('game_start', { isFirst: !p1GoesFirst });
            }
        } else {
            // No one is waiting, create a room and wait.
            let roomId = generateRoomCode();
            while(rooms[roomId]) roomId = generateRoomCode();
            rooms[roomId] = { players: [socket.id], ready: 0 };
            socket.join(roomId);
            socket.roomId = roomId;
            waitingPlayer = { id: socket.id, roomId: roomId };
            callback({ roomId: roomId, waiting: true });
        }
    });

    // --- GAMEPLAY SYNCING ---
    socket.on('deck_selected', (deck) => {
        // Acknowledges deck selection
    });

    socket.on('mulligan_done', () => {
        let roomId = socket.roomId;
        if (rooms[roomId]) {
            rooms[roomId].ready++;
            if (rooms[roomId].ready === 2) {
                // Both players finished mulligan, start the match!
                io.to(roomId).emit('begin_game');
            }
        }
    });

    // Mirrors the exact state of your playmat to the opponent
    socket.on('board_update', (data) => {
        socket.to(socket.roomId).emit('opponent_board_update', data);
    });

    // Relays specific triggers (Attacks, KOs, Counters, Freezes)
    socket.on('game_action', (data) => {
        socket.to(socket.roomId).emit('game_action', data);
    });

    // Passes the turn
    socket.on('pass_turn', () => {
        socket.to(socket.roomId).emit('turn_passed');
    });

    // Chat functionality
    socket.on('chat_msg', (msg) => {
        socket.to(socket.roomId).emit('chat_msg', msg);
    });

    // --- DISCONNECT HANDLING ---
    socket.on('disconnect', () => {
        console.log('A player disconnected:', socket.id);
        
        // Remove from matchmaking queue if they leave while searching
        if (waitingPlayer && waitingPlayer.id === socket.id) {
            waitingPlayer = null;
        }
        
        // If they leave during a match, auto-concede for them
        if (socket.roomId && rooms[socket.roomId]) {
            socket.to(socket.roomId).emit('game_action', { type: 'concede' }); 
            delete rooms[socket.roomId]; // Destroy the room
        }
    });
});

// --- BOOT THE SERVER ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(`OPCG Master Engine Running on Port ${PORT}`);
    console.log(`Ready for battles!`);
    console.log(`=========================================`);
});

