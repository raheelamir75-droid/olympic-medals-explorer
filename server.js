// Olympic Medals Explorer - backend
// The browser never talks to PostgreSQL directly. It calls these /api routes,
// the server runs the SQL (the same queries as Part D) and sends back JSON.

require('dotenv').config();
const path = require('path');
const express = require('express');
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || '',
  database: process.env.PGDATABASE || 'postgres',
});

const S = 'olympics_learning';
const app = express();

app.use(express.static(path.join(__dirname, 'public')));
app.use('/vendor', express.static(path.join(__dirname, 'node_modules/chart.js/dist')));
app.use('/flags', express.static(path.join(__dirname, 'node_modules/flag-icons/flags/4x3')));
app.use('/fonts', express.static(path.join(__dirname, 'node_modules/@fontsource/bebas-neue/files')));
app.use('/fonts', express.static(path.join(__dirname, 'node_modules/@fontsource/inter/files')));

// ---------- helpers ----------
const SOUTH_ASIA = ['PAK', 'IND', 'BAN', 'SRI', 'NEP', 'BHU', 'MDV', 'AFG'];
const MEDALS = ['Gold', 'Silver', 'Bronze'];

// Reads ?from=&to=&season=&medals= from the URL and keeps only safe values.
function filters(q) {
  let from = parseInt(q.from, 10);
  let to = parseInt(q.to, 10);
  if (!Number.isFinite(from)) from = 1896;
  if (!Number.isFinite(to)) to = 2016;
  const season = ['Summer', 'Winter'].includes(q.season) ? q.season : 'All';
  let medals = String(q.medals || 'Gold,Silver,Bronze')
    .split(',')
    .filter((m) => MEDALS.includes(m));
  if (medals.length === 0) medals = MEDALS;
  return { from, to, season, medals };
}

function noc(value) {
  const v = String(value || '').toUpperCase();
  if (!/^[A-Z]{3}$/.test(v)) throw Object.assign(new Error('Bad country code'), { status: 400 });
  return v;
}

// Shared WHERE clause for medal queries. $1 from, $2 to, $3 season, $4 medals.
const MEDAL_FILTER = `
  a.year BETWEEN $1 AND $2
  AND ($3 = 'All' OR g.season = $3)
  AND a.medal = ANY($4)`;

const route = (fn) => async (req, res) => {
  try {
    res.json(await fn(req));
  } catch (err) {
    console.error(err.message);
    res.status(err.status || 500).json({ error: err.message });
  }
};

const rows = async (sql, params = []) => (await pool.query(sql, params)).rows;

// ---------- API ----------

// Headline numbers for the hero section
app.get('/api/summary', route(async () => {
  const [r] = await rows(`
    SELECT
      (SELECT COUNT(*) FROM ${S}.raw_athlete_events)::int AS raw_records,
      (SELECT COUNT(*) FROM ${S}.participation)::int      AS medal_records,
      (SELECT COUNT(*) FROM ${S}.athlete)::int            AS athletes,
      (SELECT COUNT(*) FROM ${S}.games)::int              AS games,
      (SELECT COUNT(*) FROM ${S}.sport)::int              AS sports,
      (SELECT COUNT(*) FROM ${S}.event)::int              AS events,
      (SELECT COUNT(DISTINCT noc) FROM ${S}.competition_awards)::int AS countries`);
  return r;
}));

// Country list for the dropdowns (only countries that won at least one medal + South Asia)
app.get('/api/countries', route(async () => rows(`
  SELECT c.noc, c.region AS country, COUNT(a.event_id)::int AS total
  FROM ${S}.country c
  LEFT JOIN ${S}.competition_awards a ON a.noc = c.noc
  GROUP BY c.noc, c.region
  ORDER BY c.region, c.noc`)));

// Global top N medal table
app.get('/api/top', route(async (req) => {
  const f = filters(req.query);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 3), 25);
  return rows(`
    SELECT a.noc, c.region AS country,
           COUNT(*) FILTER (WHERE a.medal = 'Gold')::int   AS gold,
           COUNT(*) FILTER (WHERE a.medal = 'Silver')::int AS silver,
           COUNT(*) FILTER (WHERE a.medal = 'Bronze')::int AS bronze,
           COUNT(*)::int AS total
    FROM ${S}.competition_awards a
    JOIN ${S}.games g   ON g.games_id = a.games_id
    JOIN ${S}.country c ON c.noc = a.noc
    WHERE ${MEDAL_FILTER}
    GROUP BY a.noc, c.region
    ORDER BY total DESC, gold DESC, country
    LIMIT $5`, [f.from, f.to, f.season, f.medals, limit]);
}));

// D1: South Asian countries (zero-medal countries kept by the LEFT JOIN)
app.get('/api/south-asia', route(async (req) => {
  const f = filters(req.query);
  return rows(`
    SELECT c.noc, c.region AS country,
           COUNT(a.event_id) FILTER (WHERE a.medal = 'Gold')::int   AS gold,
           COUNT(a.event_id) FILTER (WHERE a.medal = 'Silver')::int AS silver,
           COUNT(a.event_id) FILTER (WHERE a.medal = 'Bronze')::int AS bronze,
           COUNT(a.event_id)::int AS total
    FROM ${S}.country c
    LEFT JOIN (
      SELECT a.* FROM ${S}.competition_awards a
      JOIN ${S}.games g ON g.games_id = a.games_id
      WHERE ${MEDAL_FILTER}
    ) a ON a.noc = c.noc
    WHERE c.noc = ANY($5)
    GROUP BY c.noc, c.region
    ORDER BY total DESC, country`, [f.from, f.to, f.season, f.medals, SOUTH_ASIA]);
}));

// D2: one country's medals by sport
app.get('/api/country/:noc/sports', route(async (req) => {
  const f = filters(req.query);
  return rows(`
    SELECT s.sport_name AS sport,
           COUNT(*) FILTER (WHERE a.medal = 'Gold')::int   AS gold,
           COUNT(*) FILTER (WHERE a.medal = 'Silver')::int AS silver,
           COUNT(*) FILTER (WHERE a.medal = 'Bronze')::int AS bronze,
           COUNT(*)::int AS total
    FROM ${S}.competition_awards a
    JOIN ${S}.games g ON g.games_id = a.games_id
    JOIN ${S}.event e ON e.event_id = a.event_id
    JOIN ${S}.sport s ON s.sport_id = e.sport_id
    WHERE a.noc = $5 AND ${MEDAL_FILTER}
    GROUP BY s.sport_name
    ORDER BY total DESC, sport
    LIMIT 12`, [f.from, f.to, f.season, f.medals, noc(req.params.noc)]);
}));

// D5 (one country): medals per Olympic year, zero-filled for every Games in range
app.get('/api/country/:noc/timeline', route(async (req) => {
  const f = filters(req.query);
  return rows(`
    WITH yrs AS (
      SELECT DISTINCT g.year FROM ${S}.games g
      WHERE g.year BETWEEN $1 AND $2 AND ($3 = 'All' OR g.season = $3)
    ), m AS (
      SELECT a.year,
             COUNT(*) FILTER (WHERE a.medal = 'Gold')   AS gold,
             COUNT(*) FILTER (WHERE a.medal = 'Silver') AS silver,
             COUNT(*) FILTER (WHERE a.medal = 'Bronze') AS bronze
      FROM ${S}.competition_awards a
      JOIN ${S}.games g ON g.games_id = a.games_id
      WHERE a.noc = $5 AND ${MEDAL_FILTER}
      GROUP BY a.year
    )
    SELECT y.year::int,
           COALESCE(m.gold, 0)::int   AS gold,
           COALESCE(m.silver, 0)::int AS silver,
           COALESCE(m.bronze, 0)::int AS bronze
    FROM yrs y LEFT JOIN m ON m.year = y.year
    ORDER BY y.year`, [f.from, f.to, f.season, f.medals, noc(req.params.noc)]);
}));

// D5: two countries head to head, medals per Olympic year
app.get('/api/compare', route(async (req) => {
  const f = filters(req.query);
  const a = noc(req.query.a || 'IND');
  const b = noc(req.query.b || 'PAK');
  return rows(`
    WITH yrs AS (
      SELECT DISTINCT g.year FROM ${S}.games g
      WHERE g.year BETWEEN $1 AND $2 AND ($3 = 'All' OR g.season = $3)
    ), m AS (
      SELECT a.year, a.noc, COUNT(*) AS n
      FROM ${S}.competition_awards a
      JOIN ${S}.games g ON g.games_id = a.games_id
      WHERE a.noc IN ($5, $6) AND ${MEDAL_FILTER}
      GROUP BY a.year, a.noc
    )
    SELECT y.year::int,
           COALESCE(SUM(m.n) FILTER (WHERE m.noc = $5), 0)::int AS a_total,
           COALESCE(SUM(m.n) FILTER (WHERE m.noc = $6), 0)::int AS b_total
    FROM yrs y LEFT JOIN m ON m.year = y.year
    GROUP BY y.year
    ORDER BY y.year`, [f.from, f.to, f.season, f.medals, a, b]);
}));

// D3: athletes sent to each Games (raw table: clean tables hold medal winners only)
app.get('/api/country/:noc/athletes', route(async (req) => {
  const f = filters(req.query);
  return rows(`
    SELECT games, year::int AS year, season, COUNT(DISTINCT id)::int AS athletes
    FROM ${S}.raw_athlete_events
    WHERE noc = $4
      AND year::int BETWEEN $1 AND $2
      AND ($3 = 'All' OR season = $3)
    GROUP BY games, year, season
    ORDER BY year, season`, [f.from, f.to, f.season, noc(req.params.noc)]);
}));

// D4: athletes with the most Olympic appearances
app.get('/api/country/:noc/appearances', route(async (req) => rows(`
  SELECT name, COUNT(DISTINCT games)::int AS appearances,
         MIN(year::int) AS first_year, MAX(year::int) AS last_year,
         MIN(sport) AS sport
  FROM ${S}.raw_athlete_events
  WHERE noc = $1
  GROUP BY id, name
  ORDER BY appearances DESC, name
  LIMIT 10`, [noc(req.params.noc)])));

// D7: top country in each major sport
const MAJOR_SPORTS = ['Athletics','Swimming','Wrestling','Boxing','Hockey',
                      'Gymnastics','Shooting','Cycling','Fencing','Rowing'];
app.get('/api/sports', route(async (req) => {
  const f = filters(req.query);
  return rows(`
    SELECT DISTINCT ON (s.sport_name)
           s.sport_name AS sport, c.region AS country, MIN(a.noc) AS noc, COUNT(*)::int AS medals
    FROM ${S}.competition_awards a
    JOIN ${S}.games g   ON g.games_id = a.games_id
    JOIN ${S}.event e   ON e.event_id = a.event_id
    JOIN ${S}.sport s   ON s.sport_id = e.sport_id
    JOIN ${S}.country c ON c.noc = a.noc
    WHERE ${MEDAL_FILTER} AND s.sport_name = ANY($5)
    GROUP BY s.sport_name, c.region
    ORDER BY s.sport_name, medals DESC`, [f.from, f.to, f.season, f.medals, MAJOR_SPORTS]);
}));

// D8: medal-winning countries per Olympic year
app.get('/api/growth', route(async (req) => {
  const f = filters(req.query);
  return rows(`
    SELECT g.year::int AS year,
           COUNT(DISTINCT a.noc)::int AS countries,
           COUNT(*)::int AS medals
    FROM ${S}.competition_awards a
    JOIN ${S}.games g ON g.games_id = a.games_id
    WHERE ${MEDAL_FILTER}
    GROUP BY g.year
    ORDER BY g.year`, [f.from, f.to, f.season, f.medals]);
}));

// D9: share of women among medal winners, by decade
app.get('/api/women', route(async (req) => {
  const f = filters(req.query);
  return rows(`
    SELECT (g.year / 10) * 10 AS decade,
           COUNT(*) FILTER (WHERE at.sex = 'F')::int AS female,
           COUNT(*)::int AS total,
           ROUND(100.0 * COUNT(*) FILTER (WHERE at.sex = 'F') / COUNT(*), 1)::float AS percent
    FROM ${S}.participation p
    JOIN ${S}.athlete at ON at.athlete_id = p.athlete_id
    JOIN ${S}.games g    ON g.games_id = p.games_id
    WHERE g.year BETWEEN $1 AND $2
      AND ($3 = 'All' OR g.season = $3)
      AND p.medal = ANY($4)
    GROUP BY decade
    ORDER BY decade`, [f.from, f.to, f.season, f.medals]);
}));

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, async () => {
  try {
    await pool.query('SELECT 1');
    console.log(`Database connected (${pool.options.database} on port ${pool.options.port}).`);
  } catch (e) {
    console.log('Could NOT connect to the database: ' + e.message);
    console.log('Check the values in your .env file.');
  }
  console.log(`Open http://localhost:${PORT} in your browser.`);
});
