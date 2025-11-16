import express from "express";
import http from "http";
import { WebSocketServer } from "ws";

const app = express();
const server = http.createServer(app);

// Map to hold multiple WebSocket groups by deviceID
const cameraGroups = new Map();

function getGroup(id) {
  if (!cameraGroups.has(id)) {
    cameraGroups.set(id, new Set());
  }
  return cameraGroups.get(id);
}

// Parse dynamic path like /ws/DEVICEID
const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (!url.pathname.startsWith("/ws/")) {
    socket.destroy();
    return;
  }

  const deviceID = url.pathname.split("/")[2];
  if (!deviceID) {
    socket.destroy();
    return;
  }

  req.deviceID = deviceID;

  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit("connection", ws, req);
  });
});

wss.on("connection", (ws, req) => {
  const deviceID = req.deviceID;
  const group = getGroup(deviceID);

  group.add(ws);
  console.log(`Client connected to camera ${deviceID}. Total: ${group.size}`);

  ws.on("message", (data, isBinary) => {
    // Forward frame ONLY to viewers of this camera
    group.forEach((client) => {
      if (client !== ws && client.readyState === ws.OPEN) {
        client.send(data, { binary: isBinary });
      }
    });
  });

  ws.on("close", () => {
    group.delete(ws);
    console.log(`Client disconnected from ${deviceID}. Remaining: ${group.size}`);

    // Remove empty groups
    if (group.size === 0) {
      cameraGroups.delete(deviceID);
      console.log(`Camera group ${deviceID} removed (empty).`);
    }
  });
});

app.get("/", (req, res) => {
  res.send("Multi-Camera ESP32-CAM Relay Running.");
});

// Start server
const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log("Relay running on port " + port);
});
