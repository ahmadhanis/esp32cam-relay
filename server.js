const express = require("express");
const app = express();
const server = require("http").createServer(app);
const WebSocket = require("ws");

// Create WebSocket server
const wss = new WebSocket.Server({ noServer: true });

app.get("/", (req, res) => {
  res.send("ESP32-CAM WebSocket relay is running.");
});

server.on("upgrade", (req, socket, head) => {
  if (req.url === "/ws") {
    wss.handleUpgrade(req, socket, head, ws => {
      wss.emit("connection", ws, req);
    });
  } else {
    socket.destroy();
  }
});

// Broadcast frames to all clients
wss.on("connection", ws => {
  console.log("Client connected");

  ws.on("message", msg => {
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    });
  });

  ws.on("close", () => console.log("Client disconnected"));
});

// Render sets PORT in environment
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Server running on " + PORT));
