import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { Pool } from 'pg';

const PORT = process.env.PORT || 4000;
const isServerless = Boolean(process.env.VERCEL);

const defaultOrigins = [
  'http://localhost:5173',
  'http://localhost:4173',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:4173',
  'https://localhost:5173',
  'https://localhost:4173',
  'https://127.0.0.1:5173',
  'https://127.0.0.1:4173'
];

const normalizeOrigin = (origin) => {
  try {
    const parsed = new URL(origin);
    return parsed.origin;
  } catch (_err) {
    return origin;
  }
};

const normalizeOrigins = (...rawOrigins) => {
  return rawOrigins
    .flatMap((raw) => (raw ? String(raw) : ''))
    .flatMap((raw) => raw.split(/[\s,]+/))
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map(normalizeOrigin);
};

const envOrigins = normalizeOrigins(
  process.env.CLIENT_ORIGIN,
  process.env.CLIENT_ORIGINS,
  process.env.ALLOWED_ORIGINS,
  process.env.FRONTEND_ORIGIN,
  process.env.FRONTEND_URL,
  process.env.SITE_URL,
  process.env.APP_URL,
  process.env.URL,
  process.env.NEXT_PUBLIC_SITE_URL
);
const vercelOrigin = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null;
const vercelBranchOrigin = process.env.VERCEL_BRANCH_URL ? `https://${process.env.VERCEL_BRANCH_URL}` : null;
const nextPublicVercelOrigin = process.env.NEXT_PUBLIC_VERCEL_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` : null;
const allowedOrigins = Array.from(
  new Set([
    ...normalizeOrigins(...defaultOrigins),
    ...envOrigins,
    ...normalizeOrigins(vercelOrigin, vercelBranchOrigin, nextPublicVercelOrigin)
  ].filter(Boolean))
);

// Prefer explicit PGUSER, then the current OS user, finally postgres.
const pgUser = process.env.PGUSER || process.env.USER || 'postgres';

// Use hosted Postgres (e.g., Neon) when a full connection string is provided; otherwise fall back to local dev settings.
const connectionString = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;

const pool = connectionString
  ? new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false }
    })
  : new Pool({
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
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query('ALTER TABLE employees ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()');
  await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS employees_emp_number_key ON employees (emp_number)');
};

let ensureTablePromise;
const ensureDatabaseReady = () => {
  if (!ensureTablePromise) {
    ensureTablePromise = ensureTable();
  }
  return ensureTablePromise;
};

const app = express();

const buildCorsOptions = (req) => {
  const allowed = new Set(allowedOrigins);
  const originHeader = req.headers?.origin ? normalizeOrigin(req.headers.origin) : null;
  const hostHeader = req.headers?.host ? req.headers.host.trim() : null;

  if (hostHeader) {
    // Always allow the same host (covers custom domains and Vercel preview URLs).
    allowed.add(normalizeOrigin(`https://${hostHeader}`));
    allowed.add(normalizeOrigin(`http://${hostHeader}`));
  }

  // Permit any vercel.app preview/production origin automatically when deployed on Vercel.
  const vercelHostAllowed =
    originHeader &&
    (() => {
      try {
        return new URL(originHeader).hostname.endsWith('.vercel.app');
      } catch (_err) {
        return false;
      }
    })();
  if (vercelHostAllowed) {
    allowed.add(originHeader);
  }

  return {
    origin: (origin, callback) => {
      const normalizedOrigin = origin ? normalizeOrigin(origin) : origin;
      const allow = !origin || allowed.has(normalizedOrigin);

      if (!allow) {
        console.warn('Blocked CORS origin', { origin: normalizedOrigin, allowed: Array.from(allowed) });
      }

      callback(allow ? null : new Error('Origin not allowed by CORS'), allow ? true : undefined);
    }
  };
};

app.use((req, res, next) => cors(buildCorsOptions(req))(req, res, next));
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
      'INSERT INTO employees (emp_number, emp_name) VALUES ($1, $2) RETURNING id, emp_number, emp_name, created_at, updated_at',
      [number, name]
    );

    const saved = rows[0];

    res.status(201).json({
      employee: {
        id: saved.id,
        number: saved.emp_number,
        name: saved.emp_name,
        createdAt: saved.created_at,
        updatedAt: saved.updated_at
      }
    });
  } catch (error) {
    console.error('Failed to save employee', error);
    res.status(500).json({ error: 'Failed to save employee record. See server logs for details.' });
  }
});

app.get('/api/employees', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, emp_number, emp_name, created_at, updated_at FROM employees ORDER BY created_at DESC'
    );

    res.json({
      employees: rows.map((row) => ({
        id: row.id,
        number: row.emp_number,
        name: row.emp_name,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }))
    });
  } catch (error) {
    console.error('Failed to fetch employees', error);
    res.status(500).json({ error: 'Unable to load employees right now.' });
  }
});

app.put('/api/employees/:number', async (req, res) => {
  const { number: currentNumber } = req.params;
  const { name, newNumber } = req.body || {};

  if (!currentNumber) {
    return res.status(400).json({ error: 'Employee number is required.' });
  }

  if (!name) {
    return res.status(400).json({ error: 'Employee name is required.' });
  }

  const nextNumber = newNumber?.trim() || currentNumber;

  try {
    const { rows, rowCount } = await pool.query(
      `
        UPDATE employees
        SET emp_number = $1, emp_name = $2, updated_at = NOW()
        WHERE emp_number = $3
        RETURNING id, emp_number, emp_name, created_at, updated_at
      `,
      [nextNumber, name, currentNumber]
    );

    if (rowCount === 0) {
      return res.status(404).json({ error: 'Employee not found.' });
    }

    const updated = rows[0];

    res.json({
      employee: {
        id: updated.id,
        number: updated.emp_number,
        name: updated.emp_name,
        createdAt: updated.created_at,
        updatedAt: updated.updated_at
      }
    });
  } catch (error) {
    console.error('Failed to update employee', error);

    if (error?.code === '23505') {
      return res.status(409).json({ error: 'Employee number already exists.' });
    }

    res.status(500).json({ error: 'Failed to update employee. See server logs for details.' });
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
    await ensureDatabaseReady();
    app.listen(PORT, () => {
      console.log(`API running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Server failed to start', error);
    process.exit(1);
  }
};

export const handler = async (req, res) => {
  try {
    await ensureDatabaseReady();
  } catch (error) {
    console.error('Failed to prepare database', error);
    return res.status(500).json({ error: 'API failed to initialize.' });
  }

  return app(req, res);
};

export default handler;

if (!isServerless) {
  start();
}
