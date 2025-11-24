# Employee form (React + Vite)

This React single-page app lets you enter an employee number and name, saves the entry to a local Postgres database through a small Node API, and shows the saved row.

## Getting started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Set a Postgres connection string via `DATABASE_URL` (or `NEON_DATABASE_URL`). For local Postgres, ensure it is running and set credentials as needed (defaults: host `localhost`, port `5432`, database `postgres`, user from `PGUSER`/current OS user, otherwise `postgres`). Supply `PGPASSWORD` if your Postgres setup requires a password for that user:
   ```bash
   export PGPASSWORD=your_db_password
   ```
   For hosted Postgres (e.g., Neon), set `DATABASE_URL` (or `NEON_DATABASE_URL`) to your connection string that includes `sslmode=require`.
3. Start the API (creates an `employees` table if missing):
   ```bash
   npm run server
   ```
4. In another terminal, start the Vite dev server:
   ```bash
   npm run dev
   ```
5. Open the URL shown in the terminal (defaults to http://localhost:5173/). Fill in the form and click **Save** to insert the record into Postgres. The summary panel displays the saved row. Use **Clear** to reset the form.

To build for production, run `npm run build` and preview with `npm run preview`. Override the API URL by setting `VITE_API_URL` if your backend is not on `http://localhost:4000`. If you need to allow different frontend origins in development, set `CLIENT_ORIGIN` to a comma-separated list of URLs (defaults include http://localhost:5173 and http://localhost:4173 plus their 127.0.0.1 equivalents). Supply origins as scheme + host + port only (no `/index.html` path) — the server will normalize values if you add a path by mistake.

## Deploying to Vercel (with Neon)

1) In Vercel Project Settings → Environment Variables, add  
   `DATABASE_URL=postgresql://neondb_owner:npg_CKSrbLR37aYp@ep-holy-glade-ad7opfuj-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require`  
   (use the `postgresql://` scheme, not `jdbc:`).  
2) If your frontend is hosted separately, set `CLIENT_ORIGIN` to that URL (comma-separated list supported).  
3) Redeploy. The server uses `DATABASE_URL` automatically.
