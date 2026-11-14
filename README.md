Senior Citizens Bureau - ID Management System

A web-based management portal for the Office of the Senior Citizens Affairs (OSCA), Municipality of Bauan. It supports application processing and ID issuance through Admin, Staff, and ID Maker portals.

## Features

- Role-based portals and access
- Application review, status updates, and ID issuance
- Application document retrieval through Supabase Storage

## Local Setup

Requires Node.js and a configured Supabase project. The frontend and API run as separate local servers.

1. Install dependencies from the project root:

	```bash
	npm install
	```

2. Create or update the root `.env` file with the backend configuration:

	```env
	SUPABASE_URL=your_supabase_project_url
	SUPABASE_SECRET_KEY=your_supabase_secret_key
	PORT=5000
	```

	Keep `.env` private. Never expose the Supabase secret key in frontend code or commit it to source control.

3. Start the API in one terminal:

	```bash
	node backend/server.js
	```

4. Start the frontend static server in another terminal:

	```bash
	node local-server.js --port=5500
	```

5. Open [http://localhost:5500/login.html](http://localhost:5500/login.html).

The frontend currently sends API requests to `http://localhost:5000`; keep the backend on port 5000 for local use. Login and application data require valid Supabase credentials, database tables, and user records. The repository does not include seed credentials.

## Project Structure

- `login.html`, `admin.html`, `staff.html`, `idmaker.html`: Portal pages
- `app.js`, `admin.js`, `staff.js`, `idmaker.js`: Shared and portal-specific behavior
- `base.css`, `admin.css`, `staff.css`, `idmaker.css`: Shared and portal-specific styles
- `backend/`: Express API, routes, Supabase configuration, and application controller
- `local-server.js`: Static frontend development server
- `package.json`: Dependencies and frontend server scripts
