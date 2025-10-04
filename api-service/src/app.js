// src/app.js
import express from 'express';
import cors from 'cors';
import videoRoutes from './routes/video.routes.js';

const app = express();

// --- Express Middleware ---
app.use(cors({
    origin: "*", // Be more specific in production
    credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));


// --- API Routes ---
app.use('/', videoRoutes);


export { app };