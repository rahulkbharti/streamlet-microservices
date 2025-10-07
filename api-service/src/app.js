// src/app.js
import express from 'express';
import cors from 'cors';
import videoRoutes from './routes/video.routes.js';
import authRoutes from './routes/auth.routes.js';
import channelRoutes from './routes/channel.routes.js';

import ConnectMongoose from './utils/mongodb.js';
import requestLogger from './middlewares/logger.middleware.js';

const app = express();

// --- Express Middleware ---
app.use(cors({
    origin: "*", // Be more specific in production
    credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
ConnectMongoose(); // Connect to MongoDB
app.use(requestLogger);
// --- API Routes ---
app.use('/', videoRoutes);
app.use('/auth', authRoutes);
app.use('/channels', channelRoutes);

export { app };