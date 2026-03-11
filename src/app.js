import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import routes from './routes/index.js';
import { authenticate } from './middleware/auth.middleware.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Configuração CORS dinâmica para aceitar múltiplas origens
const allowedOrigins = [
  'http://localhost:4200',
  'https://wticket.godprovider.com.br',
  process.env.FRONTEND_URL
].filter(Boolean); // Remove valores undefined/null

app.use(cors({
  origin: function (origin, callback) {
    // Permitir requisições sem origin (mobile apps, postman, etc)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('CORS bloqueado para origem:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 600 // Cache preflight por 10 minutos
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', ts: Date.now() }));

// static files for uploads
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

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
