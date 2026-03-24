import express from 'express';
import cors from 'cors';
import apiRouter from './routes/api.js';
import authRouter from './routes/auth.js';
import aiRouter from './routes/ai.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Item 10: Warn if JWT_SECRET is using the insecure default
if (!process.env.JWT_SECRET) {
    console.warn('\x1b[33m⚠  JWT_SECRET not set in environment. Using insecure default. Set JWT_SECRET in .env for production.\x1b[0m');
}

// Global Logger
app.use((req, res, next) => {
    console.log(`[INCOMING] ${req.method} ${req.url} from ${req.ip}`);
    next();
});

// Item 12: CORS — restrict to localhost in development, configurable via env
const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',')
    : ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000', 'http://127.0.0.1:3000'];

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (curl, Postman, same-origin)
        if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
        callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: true
}));

app.use(express.json({ limit: '5mb' }));

// Auth Routes (public)
app.use('/api/auth', authRouter);

// Integration Routes
import integrationsRouter from './routes/integrations.js';
app.use('/api/integrations', integrationsRouter);

// AI Routes
app.use('/api/ai', aiRouter);

// MVP-1: Pipelines Routes
import pipelinesRouter from './routes/pipelines.js';
app.use('/api/pipelines', pipelinesRouter);

// MVP-2: Environments Routes
import environmentsRouter from './routes/environments.js';
app.use('/api/environments', environmentsRouter);

// API Routes
app.use('/api', apiRouter);

// Health Check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Global Error Handler — catches unhandled errors in routes and prevents server crash
app.use((err, req, res, _next) => {
    // CORS errors
    if (err.message && err.message.startsWith('CORS:')) {
        return res.status(403).json({ error: err.message });
    }
    console.error(`[ERROR] ${req.method} ${req.url}:`, err.stack || err.message || err);
    res.status(err.status || 500).json({
        error: 'Erro interno do servidor',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

import { seedDatabase } from './seed.js';
import db from './db.js';

app.listen(PORT, '0.0.0.0', () => {
    // Clear console (optional)
    // console.clear();

    const cyan = '\x1b[36m';
    const green = '\x1b[32m';
    const yellow = '\x1b[33m';
    const reset = '\x1b[0m';
    const bold = '\x1b[1m';

    console.log();
    console.log(`${cyan}${bold}🚀  DEVFLOW API SERVER${reset}`);
    console.log(`${cyan}────────────────────────────────────────${reset}`);
    console.log(`${green}✔${reset}  URL:       ${bold}http://localhost:${PORT}${reset}`);
    console.log(`${green}✔${reset}  Env:       ${bold}development${reset}`);

    // Check if admin exists, if not seed
    const adminExists = db.prepare('SELECT id FROM users WHERE id = ?').get('admin');
    if (!adminExists) {
        console.log(`${yellow}⚠  No admin found. Seeding database...${reset}`);
        seedDatabase();
        console.log(`${green}✔  Database seeded successfully.${reset}`);
    } else {
        console.log(`${green}✔${reset}  Database:  ${bold}Connected (Admin ready)${reset}`);
    }
    console.log(`${cyan}────────────────────────────────────────${reset}`);
    console.log();
});
