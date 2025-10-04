// server.js
import 'dotenv/config';
import { createServer } from 'http';
import { app } from './app.js';
import { initializeSocketIO } from './sockets/socket.handler.js';
import { initializeQueueEvents } from './queues/queue.events.js';

const PORT = process.env.PORT || 4000;

const httpServer = createServer(app);

// Initialize Socket.IO and pass the server instance
const io = initializeSocketIO(httpServer);

// Initialize BullMQ event listeners
initializeQueueEvents(io);

httpServer.listen(PORT, () => {
    console.log(`[SERVER] Listening on http://localhost:${PORT}`);
});