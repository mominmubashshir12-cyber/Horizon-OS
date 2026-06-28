// Server entry point — creates an HTTP server, attaches Socket.IO for real-time events, and starts listening.

import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import app from './app';
import { config } from './config';
import { initStaleJobChecker } from './jobs/staleJobChecker';
import { startAutoCheckoutJobs } from './jobs/autoCheckout';
import { startLunchAutoCloseJob } from './jobs/lunchAutoClose';
import { initToolOverdueChecker } from './jobs/toolOverdueChecker';
import { initMaterialHoldingChecker } from './jobs/materialHoldingChecker';
import { initMonthlyReports } from './jobs/monthlyReports';
import cron from 'node-cron';


const server = http.createServer(app);

// ─── SOCKET.IO SETUP ──────────────────────────────────────────────────────────

const io = new SocketIOServer(server, {
  cors: {
    origin: config.corsOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

io.on('connection', (socket) => {
  console.log(`[Socket.IO] Client connected: ${socket.id}`);

  // Join a firm-specific room so broadcasts can be scoped
  socket.on('join-firm', (firmId: number) => {
    const room = `firm-${firmId}`;
    socket.join(room);
    console.log(`[Socket.IO] ${socket.id} joined room ${room}`);
  });

  // Join a user-specific room for targeted notifications
  socket.on('join-user', (userId: number) => {
    const room = `user-${userId}`;
    socket.join(room);
    console.log(`[Socket.IO] ${socket.id} joined room ${room}`);
  });

  socket.on('disconnect', (reason) => {
    console.log(`[Socket.IO] Client disconnected: ${socket.id} (${reason})`);
  });
});

// Export io so other modules (services, routes) can emit events
export { io };

// ─── START SERVER ──────────────────────────────────────────────────────────────

server.listen(config.port, () => {
  // Start scheduled cron jobs
  initStaleJobChecker();
  startAutoCheckoutJobs();
  startLunchAutoCloseJob();
  initMonthlyReports();
  initToolOverdueChecker();
  initMaterialHoldingChecker();

  console.log('╔═══════════════════════════════════════════════════╗');
  console.log('║           HORIZON OS — Backend Server            ║');
  console.log('╠═══════════════════════════════════════════════════╣');
  console.log(`║  Environment : ${config.nodeEnv.padEnd(35)}║`);
  console.log(`║  Port        : ${String(config.port).padEnd(35)}║`);
  console.log(`║  Health      : http://localhost:${config.port}/api/health${' '.repeat(Math.max(0, 14 - String(config.port).length))}║`);
  console.log('╚═══════════════════════════════════════════════════╝');
});
