import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { sendError } from './utils.js';
import apiRouter from './routes/api.js';
import authRouter from './routes/auth.js';
import aiRouter from './routes/ai.js';

const app = express();
const PORT = process.env.PORT || 3001;
const STARTED_AT = new Date();

// Security: reject startup without JWT_SECRET in production
if (!process.env.JWT_SECRET) {
    if (process.env.NODE_ENV === 'production') {
        console.error('\x1b[31m✖  FATAL: JWT_SECRET environment variable is required in production. Exiting.\x1b[0m');
        process.exit(1);
    }
    console.warn('\x1b[33m⚠  JWT_SECRET not set. Using insecure default (development only). Set JWT_SECRET in .env for production.\x1b[0m');
}

// Production: redirect HTTP → HTTPS (trust proxy needed for reverse-proxy setups)
if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
    app.use((req, res, next) => {
        if (req.secure || req.headers['x-forwarded-proto'] === 'https') return next();
        res.redirect(301, `https://${req.headers.host}${req.url}`);
    });
}

// Security headers via Helmet
app.use(helmet({
    contentSecurityPolicy: false, // Disabled — SPA serves its own CSP via meta tag
    crossOriginEmbedderPolicy: false, // Allow cross-origin resources (fonts, etc.)
    hsts: process.env.NODE_ENV === 'production'
        ? { maxAge: 31536000, includeSubDomains: true, preload: true }  // 1 year HSTS
        : false,  // Disable HSTS in development to avoid localhost issues
}));

// Rate limiting — global
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 300, // 300 requests per window per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Muitas requisições. Tente novamente em alguns minutos.' },
});
app.use(globalLimiter);

// Rate limiting — strict for auth routes (login / register)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 15, // 15 attempts per 15 minutes
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Muitas tentativas de autenticação. Tente novamente mais tarde.' },
});

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

// Auth Routes (public) — strict rate limit
app.use('/api/auth', authLimiter, authRouter);

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

// Health Check: lightweight operational diagnostics for probes and monitoring.
app.get('/health', (_req, res) => {
    const checks = {};

    let dbLatencyMs = null;
    try {
        const dbStart = performance.now();
        db.prepare('SELECT 1 as ok').get();
        dbLatencyMs = Number((performance.now() - dbStart).toFixed(2));
        checks.database = {
            status: 'ok',
            latencyMs: dbLatencyMs,
        };
    } catch (error) {
        checks.database = {
            status: 'down',
            message: process.env.NODE_ENV === 'production' ? 'Database unavailable' : (error.message || 'Database unavailable'),
        };
    }

    const jwtSecretConfigured = Boolean(process.env.JWT_SECRET);
    let jwtSecretStatus = 'ok';
    if (!jwtSecretConfigured) {
        jwtSecretStatus = process.env.NODE_ENV === 'production' ? 'down' : 'warning';
    }
    checks.jwtSecret = {
        status: jwtSecretStatus,
    };

    const isDegraded = checks.database.status !== 'ok' || checks.jwtSecret.status === 'down';
    const memoryUsage = process.memoryUsage();

    const payload = {
        status: isDegraded ? 'degraded' : 'ok',
        service: 'devflow-api',
        timestamp: new Date().toISOString(),
        startedAt: STARTED_AT.toISOString(),
        uptimeSeconds: Number(process.uptime().toFixed(2)),
        environment: process.env.NODE_ENV || 'development',
        nodeVersion: process.version,
        checks,
        metrics: {
            memory: {
                rss: memoryUsage.rss,
                heapUsed: memoryUsage.heapUsed,
                heapTotal: memoryUsage.heapTotal,
            },
        },
    };

    res.status(isDegraded ? 503 : 200).json(payload);
});

// Global Error Handler — catches unhandled errors in routes and prevents server crash
app.use((err, req, res, _next) => {
    // CORS errors
    if (err.message && err.message.startsWith('CORS:')) {
        return sendError(res, 403, err.message);
    }
    console.error(`[ERROR] ${req.method} ${req.url}:`, err.stack || err.message || err);
    sendError(res, err.status || 500, 'Erro interno do servidor', err.message);
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
