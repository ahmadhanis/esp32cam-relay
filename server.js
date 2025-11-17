import express from "express";
import http from "http";
import { WebSocketServer } from "ws";

const app = express();
const server = http.createServer(app);

// WebSocket server on /ws path
const wss = new WebSocketServer({
  server,
  path: "/ws"
});

app.get("/", (req, res) => {
  res.send("ESP32-CAM Multi-Stream WebSocket Relay Running.");
});

wss.on("connection", (ws, req) => {
  // 1. Parse Device ID from URL parameters
  // Example URL: ws://localhost:3000/ws?id=24:6F:28:A1:B2:C3
  const url = new URL(req.url, `http://${req.headers.host}`);
  const deviceId = url.searchParams.get("id");

  if (!deviceId) {
    console.log("Client rejected: No Device ID provided.");
    ws.close(); // Close connection if no ID is provided
    return;
  }

  // 2. Attach the Device ID to the WebSocket client object for later identification
  ws.deviceId = deviceId;
  
  console.log(`Client connected to stream: ${deviceId}`);

  ws.on("message", (data, isBinary) => {
    // Optional: Log frame size (can be noisy for video streams)
    // console.log(`Frame from ${ws.deviceId}:`, isBinary ? data.byteLength : data.length);

    // 3. Broadcast to clients matching the SAME Device ID
    wss.clients.forEach((client) => {
      // Check if client is open, is not the sender, and shares the same deviceId
      if (
        client !== ws && 
        client.readyState === ws.OPEN && 
        client.deviceId === ws.deviceId
      ) {
        client.send(data, { binary: isBinary });
      }
    });
  });

  ws.on("close", () => {
    console.log(`Client disconnected from stream: ${ws.deviceId}`);
  });
  
  ws.on("error", (error) => {
    console.error(`WebSocket error on ${ws.deviceId}:`, error);
  });
});

// Render PORT
const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log("Relay server running on", port);
});
