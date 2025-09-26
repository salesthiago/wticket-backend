import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import routes from './routes/index.js';
import { authenticate } from './middleware/auth.middleware.js';

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:4200",
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', ts: Date.now() }));

// routes
app.use('/api', routes);

// protected example route
app.get('/profile', authenticate, (req, res) => {
  res.json({ user: req.user });
});

// fallback
app.use((req, res) => {
  res.status(404).json({ message: 'Not Found' });
});


export default app;
