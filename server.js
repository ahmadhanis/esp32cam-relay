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
  res.send("ESP32-CAM WebSocket Relay Running.");
});

wss.on("connection", (ws) => {
  console.log("Client connected");

  ws.on("message", (data, isBinary) => {
    console.log("Forwarding frame:", isBinary ? data.byteLength : data.length);

    // Broadcast to all connected clients except the sender
    wss.clients.forEach((client) => {
      if (client !== ws && client.readyState === ws.OPEN) {
        client.send(data, { binary: isBinary });
      }
    });
  });

  ws.on("close", () => console.log("Client disconnected"));
});

// Render PORT
const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log("Relay server running on", port);
});
