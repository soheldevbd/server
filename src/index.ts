import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { connectDB } from './db';
import { bookRouter } from './routes/books';
import { borrowRouter } from './routes/borrows';
const app = express();
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:3000')
  .split(',')
  .map(value => value.trim())
  .filter(Boolean);
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin))
        return callback(null, true);
      return callback(new Error('Origin is not allowed by BookNook CORS'));
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));
app.get('/api/health', (_req, res) =>
  res.json({ status: 'ok', service: 'BookNook API' }),
);
app.use('/api/books', bookRouter);
app.use('/api/borrows', borrowRouter);
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  },
);
const port = Number(process.env.PORT || 5000);
connectDB()
  .then(() =>
    app.listen(port, () => console.log(`BookNook API listening on ${port}`)),
  )
  .catch(e => {
    console.error(e);
    process.exit(1);
  });
