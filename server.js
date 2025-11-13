import express from "express";
import { WebSocketServer } from "ws";
import http from "http";

const app = express();
const server = http.createServer(app);

// Create websocket server on same HTTP server
const wss = new WebSocketServer({ server, path: "/ws" });

app.get("/", (req, res) => {
  res.send("ESP32-CAM relay running.");
});

// Main relay logic
wss.on("connection", (ws) => {
  console.log("Client connected");

  ws.on("message", (data, isBinary) => {
    // Relay to all viewers
    for (const client of wss.clients) {
      if (client !== ws && client.readyState === ws.OPEN) {
        client.send(data, { binary: isBinary });
      }
    }
  });

  ws.on("close", () => {
    console.log("Client disconnected");
  });
});

// Listen on Render assigned port
const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`Relay listening on ${port}`);
});
