const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Middleware for parsing JSON payloads from ESP32
app.use(express.json());

// Serve static frontend files (index.html, styles, scripts) from the root directory
app.use(express.static(__dirname));

// Default Standby Telemetry State
let latestTelemetry = {
    waterLevel: 0,
    decantationDepth: 0,
    relayStatus: "OFF",
    turbidity: 0,
    systemStatus: "STANDBY",
    lastUpdated: new Date().toISOString()
};

// Route: Serve index.html explicitly on root GET request
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Route: ESP32 telemetry submission endpoint
app.post('/api/telemetry', (req, res) => {
    const { waterLevel, decantationDepth, relayStatus, turbidity, systemStatus } = req.body;

    latestTelemetry = {
        waterLevel: waterLevel !== undefined ? waterLevel : latestTelemetry.waterLevel,
        decantationDepth: decantationDepth !== undefined ? decantationDepth : latestTelemetry.decantationDepth,
        relayStatus: relayStatus || latestTelemetry.relayStatus,
        turbidity: turbidity !== undefined ? turbidity : latestTelemetry.turbidity,
        systemStatus: systemStatus || "ONLINE",
        lastUpdated: new Date().toISOString()
    };

    // Broadcast updated telemetry instantly to all connected web clients
    io.emit('telemetryUpdate', latestTelemetry);

    console.log('[TELEMETRY RECEIVED]:', latestTelemetry);
    return res.status(200).json({ success: true, message: "Telemetry updated successfully" });
});

// Route: Get current telemetry snapshot
app.get('/api/telemetry', (req, res) => {
    res.json(latestTelemetry);
});

// WebSocket Connection Logic
io.on('connection', (socket) => {
    console.log(`[CLIENT CONNECTED]: ${socket.id}`);

    // Instantly send the latest telemetry state to the newly connected frontend
    socket.emit('telemetryUpdate', latestTelemetry);

    socket.on('disconnect', () => {
        console.log(`[CLIENT DISCONNECTED]: ${socket.id}`);
    });
});

// Port configuration for Render
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`=================================`);
    console.log(`AquaPure System Server Active`);
    console.log(`Listening on port: ${PORT}`);
    console.log(`=================================`);
});
      
