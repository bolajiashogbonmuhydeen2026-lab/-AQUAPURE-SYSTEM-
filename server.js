const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Latest stored telemetry state matching the dashboard
let systemState = {
  depth: 19.5,
  capacity: 30,
  percentage: 65,
  relayStatus: "ACTIVE",
  flowRate: 2.4,
  dryRunStatus: "NORMAL",
  voltage: 5.0,
  timestamp: new Date().toISOString()
};

// ESP32 sends telemetry data here via HTTP POST
app.post('/api/telemetry', (req, res) => {
  const { depth, relayStatus, flowRate, dryRunStatus, voltage } = req.body;
  
  if (depth !== undefined) systemState.depth = parseFloat(depth);
  if (relayStatus !== undefined) systemState.relayStatus = relayStatus;
  if (flowRate !== undefined) systemState.flowRate = parseFloat(flowRate);
  if (dryRunStatus !== undefined) systemState.dryRunStatus = dryRunStatus;
  if (voltage !== undefined) systemState.voltage = parseFloat(voltage);
  
  systemState.percentage = Math.round((systemState.depth / systemState.capacity) * 100);
  systemState.timestamp = new Date().toISOString();

  // Broadcast live data to all connected frontend clients via WebSockets
  io.emit('telemetryUpdate', systemState);
  
  res.status(200).json({ status: 'success', data: systemState });
});

// Frontend polls or fetches current state
app.get('/api/telemetry', (req, res) => {
  res.status(200).json(systemState);
});

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('Client connected to AquaPure telemetry stream:', socket.id);
  
  // Send current state immediately upon connection
  socket.emit('telemetryUpdate', systemState);

  // Handle manual relay toggle override from web dashboard
  socket.on('controlOverride', (command) => {
    console.log('Received control override command:', command);
    // Broadcast command to ESP32 or update state
    io.emit('relayCommand', command);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`AquaPure Executive Server running on port ${PORT}`);
});
