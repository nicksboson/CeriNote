# CeriNote

Voice conversation recorder with a React frontend and Express.js backend.

## Project Structure

```
CeriNote/
├── frontend/          # React + Vite + TailwindCSS
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Record.jsx
│   │   │   └── Record.css
│   │   ├── App.jsx
│   │   ├── App.css
│   │   ├── main.jsx
│   │   └── index.css
│   ├── public/
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── backend/           # Node.js + Express
│   ├── src/
│   │   ├── index.js
│   │   └── routes/
│   │       └── recordings.js
│   ├── uploads/
│   └── package.json
└── README.md
```

## Getting Started

### 1. Backend

```bash
cd backend
npm install
npm run dev
```

The API runs at `http://localhost:5000`

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

The app runs at `http://localhost:5173`

### API Endpoints

| Method | Endpoint                    | Description            |
| ------ | --------------------------- | ---------------------- |
| GET    | `/api/health`               | Health check           |
| GET    | `/api/recordings`           | List all recordings    |
| GET    | `/api/recordings/:id`       | Get single recording   |
| POST   | `/api/recordings/upload`    | Upload a recording     |
| DELETE | `/api/recordings/:id`       | Delete a recording     |