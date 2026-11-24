# Olympic Medals Explorer

Website for our database **Global Olympic Medals Database: 120 Years of Winners (1896–2016)**.

```
Browser (public/)  ->  Node.js server (server.js)  ->  PostgreSQL (olympics_learning schema)
```

## How to run

1. Install **Node.js (LTS)** from https://nodejs.org
2. Open this folder in VS Code (or a terminal) and run:
   ```
   npm install
   ```
3. Copy `.env.example`, rename the copy to `.env`, and set your PostgreSQL password and database name
   (the database where the `olympics_learning` schema is, e.g. `Olympics_sa_00`).
4. Start the server:
   ```
   npm start
   ```
5. Open http://localhost:3000

## Files

| File | What it does |
|---|---|
| `server.js` | API routes. Each route runs one SQL query (the Part D queries) and returns JSON |
| `public/index.html` | Page layout |
| `public/style.css` | Design and animations |
| `public/app.js` | Filters, charts (Chart.js) and calls to the API |

## API routes

| Route | Query |
|---|---|
| `/api/summary` | Row counts for the hero section |
| `/api/top` | Global top 10 medal table |
| `/api/south-asia` | D1 |
| `/api/country/:noc/sports` | D2 |
| `/api/country/:noc/athletes` | D3 |
| `/api/country/:noc/appearances` | D4 |
| `/api/country/:noc/timeline`, `/api/compare` | D5 |

All routes accept `from`, `to`, `season` (All/Summer/Winter) and `medals` (e.g. `Gold,Silver`).
Values are passed to PostgreSQL as parameters ($1, $2 ...), never pasted into the SQL text.
