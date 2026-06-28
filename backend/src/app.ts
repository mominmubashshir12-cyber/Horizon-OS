// Express application setup — configures middleware, mounts all route modules under /api, and attaches the global error handler.

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';
import { errorHandler } from './middleware/errorHandler';

// Route imports
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import jobcardRoutes from './routes/jobcards';
import attendanceRoutes from './routes/attendance';
import toolRoutes from './routes/tools';
import materialRoutes from './routes/materials';
import productRoutes from './routes/products';
import saleRoutes from './routes/sales';
import quotationRoutes from './routes/quotations';
import dashboardRoutes from './routes/dashboard';
import reportRoutes from './routes/reports';
import alertRoutes from './routes/alerts';
import syncRoutes from './routes/sync';
import antifraudRoutes from './routes/antifraud';
import cashflowRoutes from './routes/cashflow';
import settingsRoutes from './routes/settings';
import addonRoutes from './routes/addons';

const app = express();

// ─── GLOBAL MIDDLEWARE ─────────────────────────────────────────────────────────

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(
  cors({
    origin: config.corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── HEALTH CHECK ──────────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.status(200).json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: config.nodeEnv,
      version: '1.0.0',
    },
    message: 'Horizon OS backend is running',
  });
});

// ─── ROUTE MOUNTING ────────────────────────────────────────────────────────────

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/jobcards', jobcardRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/tools', toolRoutes);
app.use('/api/materials', materialRoutes);
app.use('/api/products', productRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/quotations', quotationRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/antifraud', antifraudRoutes);
app.use('/api/cashflow', cashflowRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/addons', addonRoutes);

// ─── 404 CATCH-ALL ─────────────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({
    success: false,
    data: null,
    message: `Route not found: ${_req.method} ${_req.originalUrl}`,
  });
});

// ─── GLOBAL ERROR HANDLER (must be last) ───────────────────────────────────────

app.use(errorHandler);

export default app;
