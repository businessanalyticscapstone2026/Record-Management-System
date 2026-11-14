Senior Citizens Bureau - ID Management System

A web-based management portal for the Office of the Senior Citizens Affairs (OSCA), Municipality of Bauan. It supports application processing and ID issuance through Admin, Staff, and ID Maker portals.

## Features

- Role-based portals and access
- Application review, status updates, and ID issuance
- Application document retrieval through Supabase Storage
- AI-assisted analytics and Bauan residency validation

## Local Setup

Requires Node.js 22 or later and a configured Supabase project.

1. Install dependencies from the project root:

   ```bash
   npm install
   ```

2. Create a root `.env` file:

   ```env
   SUPABASE_URL=your_supabase_project_url
   SUPABASE_SECRET_KEY=your_supabase_secret_key
   PORT=5000
   ```

   Keep `.env` private. Never expose the Supabase secret key in frontend code or commit it to source control.

3. Start both the Express API and the frontend static server with one command:

   ```bash
   npm start
   ```

4. Open [http://localhost:5500/login.html](http://localhost:5500/login.html).

The local frontend proxies `/api`, `/health`, and `/healthz` requests to the backend on port 5000. This keeps browser requests same-origin, just like the Vercel deployment. To run either service separately, use `npm run start:backend` and `npm run start:frontend` in separate terminals.

Login and application data require valid Supabase credentials, database tables, and user records. The repository does not include seed credentials.

## Vercel Deployment

The Vercel function entry point is `api/index.js`, which exports the Express application from `backend/server.js`. Static portal files are served directly by Vercel, while API and health requests are routed to the function by `vercel.json`.

Configure the same backend environment variables in the Vercel project's Environment Variables. AI analytics and AI-assisted residency validation additionally require at least one configured provider:
- `GROQ_API_KEY` (optional `GROQ_MODEL`)
- `OPENROUTER_API_KEY` (optional `OPENROUTER_MODEL`)
- `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` (optional `CLOUDFLARE_AI_MODEL`)

Do not commit API keys.

## Project Structure

- `login.html`, `admin.html`, `staff.html`, `idmaker.html`: Portal pages
- `app.js`, `admin.js`, `staff.js`, `idmaker.js`: Portal behavior
- `base.css`, `admin.css`, `staff.css`, `idmaker.css`: Portal styles
- `backend/`: Express API, routes, Supabase configuration, and controllers
- `api/index.js`: Vercel serverless entry point
- `local-server.js`: Local frontend server and same-origin API proxy
- `local-dev.js`: Starts the local backend and frontend together
- `vercel.json`: Vercel API routing
