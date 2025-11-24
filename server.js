import express from 'express';
import cors from 'cors';
import { Pool } from 'pg';

const PORT = process.env.PORT || 4000;
const defaultOrigins = [
  'http://localhost:5173',
  'http://localhost:4173',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:4173'
];

const normalizeOrigins = (raw) => {
  if (!raw) return [];

  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map((origin) => {
      try {
        // Strips any path/query so accidental values like http://localhost:5173/index.html still work.
        const parsed = new URL(origin);
        return parsed.origin;
      } catch (_err) {
        return origin;
      }
    });
};

const envOrigins = normalizeOrigins(process.env.CLIENT_ORIGIN);
const allowedOrigins = Array.from(new Set([...defaultOrigins, ...envOrigins]));

// Prefer explicit PGUSER, then the current OS user, finally postgres.
const pgUser = process.env.PGUSER || process.env.USER || 'postgres';

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || 'postgres',
  user: pgUser,
  password: process.env.PGPASSWORD
});

pool.on('error', (error) => {
  console.error('Unexpected Postgres error', error);
});

const ensureTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS employees (
      id SERIAL PRIMARY KEY,
      emp_number TEXT NOT NULL,
      emp_name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
};

const app = express();

app.use(
  cors({
    origin: (origin, callback) => {
      const allow = !origin || allowedOrigins.includes(origin);
      callback(allow ? null : new Error('Origin not allowed by CORS'), allow ? origin || true : undefined);
    }
  })
);
app.use(express.json());

app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch (error) {
    console.error('Health check failed', error);
    res.status(500).json({ status: 'error' });
  }
});

app.post('/api/employees', async (req, res) => {
  const { number, name } = req.body || {};

  if (!number || !name) {
    return res.status(400).json({ error: 'Both employee number and name are required.' });
  }

  try {
    const { rows } = await pool.query(
      'INSERT INTO employees (emp_number, emp_name) VALUES ($1, $2) RETURNING id, emp_number, emp_name, created_at',
      [number, name]
    );

    const saved = rows[0];

    res.status(201).json({
      employee: {
        id: saved.id,
        number: saved.emp_number,
        name: saved.emp_name,
        createdAt: saved.created_at
      }
    });
  } catch (error) {
    console.error('Failed to save employee', error);
    res.status(500).json({ error: 'Failed to save employee record. See server logs for details.' });
  }
});

app.delete('/api/employees/:number', async (req, res) => {
  const { number } = req.params;

  if (!number) {
    return res.status(400).json({ error: 'Employee number is required.' });
  }

  try {
    const { rowCount } = await pool.query('DELETE FROM employees WHERE emp_number = $1', [number]);

    if (rowCount === 0) {
      return res.status(404).json({ error: 'Employee not found.' });
    }

    res.json({ status: 'deleted' });
  } catch (error) {
    console.error('Failed to delete employee', error);
    res.status(500).json({ error: 'Failed to delete employee. See server logs for details.' });
  }
});

const start = async () => {
  try {
    await ensureTable();
    app.listen(PORT, () => {
      console.log(`API running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Server failed to start', error);
    process.exit(1);
  }
};

start();
