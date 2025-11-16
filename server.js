import express from "express";
import http from "http";
import { WebSocketServer } from "ws";

const app = express();
const server = http.createServer(app);

const wss = new WebSocketServer({ noServer: true });

// A map of deviceID → Set of clients (browsers)
const viewers = new Map();

// A map of deviceID → camera socket (ESP32)
const cameras = new Map();

app.get("/", (req, res) => {
  res.send("ESP32-CAM Multi-Relay Server Running.");
});

server.on("upgrade", (req, socket, head) => {
  const url = req.url; // example: /ws/4417937C9710

  if (!url.startsWith("/ws/")) {
    socket.destroy();
    return;
  }

  const deviceID = url.replace("/ws/", "");

  wss.handleUpgrade(req, socket, head, (ws) => {
    ws.deviceID = deviceID;
    wss.emit("connection", ws, req);
  });
});

wss.on("connection", (ws, req) => {
  const deviceID = ws.deviceID;

  // Determine if it's a camera or viewer
  if (!cameras.has(deviceID)) {
    // First device connected → assume CAMERA
    cameras.set(deviceID, ws);
    console.log(`📷 Camera connected: ${deviceID}`);
  } else {
    // Viewer connected
    if (!viewers.has(deviceID)) viewers.set(deviceID, new Set());
    viewers.get(deviceID).add(ws);
    console.log(`👁 Viewer connected to ${deviceID}`);

    // If camera is offline → notify viewer
    if (cameras.get(deviceID) == null) {
      ws.send("NO_CAMERA");
    }
  }

  ws.on("message", (data, isBinary) => {
    // Forward camera frames to all viewers of this device
    if (cameras.get(deviceID) === ws) {
      const viewSet = viewers.get(deviceID) || [];

      for (const client of viewSet) {
        if (client.readyState === 1) client.send(data, { binary: isBinary });
      }
    }
  });

  ws.on("close", () => {
    // If CAMERA disconnected
    if (cameras.get(deviceID) === ws) {
      console.log(`📴 Camera disconnected: ${deviceID}`);
      cameras.set(deviceID, null);
    }

    // If VIEWER disconnected
    if (viewers.has(deviceID)) {
      viewers.get(deviceID).delete(ws);
    }
  });
});

// PORT
const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log("Relay server running on port", port);
});
