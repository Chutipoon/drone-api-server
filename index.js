require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(
  cors({
    origin: '*',
    exposedHeaders: ['X-Page', 'X-Per-Page', 'X-Total-Items', 'X-Total-Pages'],
  })
);
app.use(express.json());

/**
 * Helper to fetch all drone configs from Drone Config Server (Server 1)
 */
async function fetchDroneConfigs() {
  const configUrl = process.env.CONFIG_URL;
  if (!configUrl) {
    throw new Error('Missing CONFIG_URL environment variable');
  }

  const response = await fetch(configUrl);
  if (!response.ok) {
    throw new Error(`Drone Config Server responded with status ${response.status}`);
  }

  const result = await response.json();
  return Array.isArray(result.data) ? result.data : [];
}

/**
 * Root health-check endpoint
 */
app.get('/', (req, res) => {
  res.json({
    message: 'Drone API Server (Assignment #1) is running',
    endpoints: [
      'GET /configs/:droneId',
      'GET /status/:droneId',
      'GET /logs/:droneId?page=1&perPage=12',
      'POST /logs',
    ],
  });
});

/**
 * GET /configs/:droneId
 * Returns ONLY: drone_id, drone_name, light, country, weight
 */
app.get('/configs/:droneId', async (req, res) => {
  try {
    const droneId = Number(req.params.droneId);
    if (Number.isNaN(droneId)) {
      return res.status(400).json({ error: 'Invalid droneId parameter' });
    }

    const drones = await fetchDroneConfigs();
    const drone = drones.find((item) => Number(item.drone_id) === droneId);

    if (!drone) {
      return res.status(404).json({ error: `Drone with id ${droneId} not found` });
    }

    return res.json({
      drone_id: drone.drone_id,
      drone_name: drone.drone_name,
      light: drone.light,
      country: drone.country,
      weight: drone.weight,
    });
  } catch (error) {
    console.error('Error in GET /configs/:droneId:', error.message);
    return res.status(500).json({ error: 'Failed to fetch drone config' });
  }
});

/**
 * GET /status/:droneId
 * Returns ONLY: condition
 */
app.get('/status/:droneId', async (req, res) => {
  try {
    const droneId = Number(req.params.droneId);
    if (Number.isNaN(droneId)) {
      return res.status(400).json({ error: 'Invalid droneId parameter' });
    }

    const drones = await fetchDroneConfigs();
    const drone = drones.find((item) => Number(item.drone_id) === droneId);

    if (!drone) {
      return res.status(404).json({ error: `Drone with id ${droneId} not found` });
    }

    return res.json({
      condition: drone.condition,
    });
  } catch (error) {
    console.error('Error in GET /status/:droneId:', error.message);
    return res.status(500).json({ error: 'Failed to fetch drone status' });
  }
});

/**
 * GET /logs/:droneId
 * Fetches logs from Drone Log Server (Server 2) for the given droneId,
 * sorted by latest created first, limited to 12 items per page (supports pagination via ?page=1&perPage=12).
 * Returns JSON Array with ONLY: drone_id, drone_name, created, country, celsius
 */
app.get('/logs/:droneId', async (req, res) => {
  try {
    const droneId = Number(req.params.droneId);
    if (Number.isNaN(droneId)) {
      return res.status(400).json({ error: 'Invalid droneId parameter' });
    }

    const logUrl = process.env.LOG_URL;
    const logApiToken = process.env.LOG_API_TOKEN;

    if (!logUrl || !logApiToken) {
      return res.status(500).json({ error: 'Missing LOG_URL or LOG_API_TOKEN environment variable' });
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const perPage = Math.max(1, Math.min(50, parseInt(req.query.perPage || req.query.limit, 10) || 12));

    const url = new URL(logUrl);
    url.searchParams.set('page', String(page));
    url.searchParams.set('perPage', String(perPage));
    url.searchParams.set('sort', '-created');
    url.searchParams.set('filter', `(drone_id=${droneId})`);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${logApiToken}`,
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Log Server GET error:', response.status, errText);
      return res.status(response.status).json({ error: 'Failed to fetch logs from Drone Log Server' });
    }

    const data = await response.json();
    const items = Array.isArray(data.items) ? data.items : [];

    // Expose pagination metadata via headers while keeping response body strictly a JSON Array
    res.setHeader('X-Page', String(data.page ?? page));
    res.setHeader('X-Per-Page', String(data.perPage ?? perPage));
    res.setHeader('X-Total-Items', String(data.totalItems ?? items.length));
    res.setHeader('X-Total-Pages', String(data.totalPages ?? 1));

    const formattedLogs = items.map((log) => ({
      drone_id: log.drone_id,
      drone_name: log.drone_name,
      created: log.created,
      country: log.country,
      celsius: log.celsius,
    }));

    return res.json(formattedLogs);
  } catch (error) {
    console.error('Error in GET /logs/:droneId:', error.message);
    return res.status(500).json({ error: 'Failed to fetch drone logs' });
  }
});

/**
 * POST /logs
 * Creates a new log record on Drone Log Server (Server 2)
 * Sends ONLY: drone_id, drone_name, country, celsius
 */
app.post('/logs', async (req, res) => {
  try {
    const logUrl = process.env.LOG_URL;
    const logApiToken = process.env.LOG_API_TOKEN;

    if (!logUrl || !logApiToken) {
      return res.status(500).json({ error: 'Missing LOG_URL or LOG_API_TOKEN environment variable' });
    }

    const { drone_id, drone_name, country, celsius } = req.body || {};

    if (
      drone_id === undefined ||
      !drone_name ||
      !country ||
      celsius === undefined ||
      celsius === '' ||
      Number.isNaN(Number(celsius))
    ) {
      return res.status(400).json({
        error: 'drone_id, drone_name, country, and numeric celsius are required',
      });
    }

    // Strictly send ONLY drone_id, drone_name, country, celsius to Server 2
    const payload = {
      drone_id: Number(drone_id),
      drone_name: String(drone_name),
      country: String(country),
      celsius: Number(celsius),
    };

    const response = await fetch(logUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${logApiToken}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Log Server POST error:', response.status, errText);
      return res.status(response.status).json({ error: 'Failed to create log record on Drone Log Server' });
    }

    const createdRecord = await response.json();
    return res.status(201).json({
      drone_id: createdRecord.drone_id,
      drone_name: createdRecord.drone_name,
      created: createdRecord.created,
      country: createdRecord.country,
      celsius: createdRecord.celsius,
    });
  } catch (error) {
    console.error('Error in POST /logs:', error.message);
    return res.status(500).json({ error: 'Failed to create drone log' });
  }
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Drone API Server running at http://localhost:${PORT}`);
  });
}

module.exports = app;
