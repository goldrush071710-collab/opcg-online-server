const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);

// Tell the server to host the files inside a folder called 'public'
app.use(express.static('public'));

// Listen for players connecting
io.on('connection', (socket) => {
    console.log('A player connected! Player ID:', socket.id);

    // Listen for players disconnecting
    socket.on('disconnect', () => {
        console.log('A player disconnected:', socket.id);
    });
});

// Start the server on port 3000
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server is running! Open http://localhost:${PORT} in your browser.`);
});