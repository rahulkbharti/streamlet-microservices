// src/sockets/socket.handler.js
import { Server } from 'socket.io';

const jobIdToSocketIdMap = new Map();

let io; // Hold the io instance

const initializeSocketIO = (httpServer) => {
    io = new Server(httpServer, {
        cors: {
            origin: "*", // Be more specific in production
            methods: ["GET", "POST"]
        }
    });

    io.on('connection', (socket) => {
        console.log(`[SOCKET] Client connected: ${socket.id}`);
        socket.on('disconnect', () => {
            console.log(`[SOCKET] Client disconnected: ${socket.id}`);
            // Optional: Clean up map on disconnect
            for (const [jobId, socketId] of jobIdToSocketIdMap.entries()) {
                if (socketId === socket.id) {
                    jobIdToSocketIdMap.delete(jobId);
                }
            }
        });
    });

    return io;
};

const getSocketIdForJob = (jobId) => jobIdToSocketIdMap.get(jobId);
const addJobToSocketMap = (jobId, socketId) => jobIdToSocketIdMap.set(jobId, socketId);
const removeJobFromSocketMap = (jobId) => jobIdToSocketIdMap.delete(jobId);

export {
    initializeSocketIO,
    getSocketIdForJob,
    addJobToSocketMap,
    removeJobFromSocketMap
};