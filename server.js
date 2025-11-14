import express from "express";
import http from "http";
import { WebSocketServer } from "ws";

const app = express();
const server = http.createServer(app);

const wss = new WebSocketServer({
  server,
  path: "/ws"
});

// ----------------------
// CAMERA + VIEWER TRACKING
// ----------------------

// Map<deviceID, camera WebSocket>
const cameras = new Map();

// Map<deviceID, Set of viewer WebSockets>
const viewers = new Map();

app.get("/", (req, res) => {
  res.send("ESP32-CAM Multi-Relay Running.");
});

// ----------------------
// LIST CAMERAS (REST API)
// ----------------------
app.get("/cameras", (req, res) => {
  res.json({
    online: Array.from(cameras.keys())
  });
});


// ----------------------
// WEBSOCKET CONNECTION
// ----------------------
wss.on("connection", (ws) => {
  console.log("Client connected");

  let role = "unknown";
  let deviceID = null;

  ws.on("message", (msg, isBinary) => {

    // Convert text frames
    if (!isBinary) {
      msg = msg.toString();
    }

    // ----------------------
    // CAMERA IDENTIFICATION
    // ----------------------
    // Example: HELLO_CAMERA A3F52B
    if (msg.startsWith("HELLO_CAMERA")) {
      const parts = msg.split(" ");
      deviceID = parts[1];

      role = "camera";
      cameras.set(deviceID, ws);

      console.log(`Camera registered: ${deviceID}`);
      console.log("Viewer subscribed to camera:", deviceID);

      // If viewers exist, tell camera to start streaming
      const viewerCount = viewers.get(deviceID)?.size || 0;
      if (viewerCount > 0) {
        ws.send("START_STREAM");
      }
      return;
    }

    // ----------------------
    // VIEWER IDENTIFICATION
    // ----------------------
    // Example: VIEWER_SUB A3F52B
    if (msg.startsWith("VIEWER_SUB")) {
      const parts = msg.split(" ");
      deviceID = parts[1];

      role = "viewer";

      if (!viewers.has(deviceID)) {
        viewers.set(deviceID, new Set());
      }
      viewers.get(deviceID).add(ws);

      console.log(`Viewer subscribed to: ${deviceID}`);

      // If camera exists, tell it to start
      if (cameras.has(deviceID)) {
        cameras.get(deviceID).send("START_STREAM");
      }
      return;
    }

    // ----------------------
    // BINARY DATA FROM CAMERA
    // ----------------------
    if (role === "camera" && isBinary) {
      const subs = viewers.get(deviceID);

      if (!subs || subs.size === 0) {
        return; // no viewers → ignore frame
      }

      for (const v of subs) {
        if (v.readyState === ws.OPEN) {
          v.send(msg, { binary: true });
        }
      }
      return;
    }

  }); // end message handler


  // ----------------------
  // CLEANUP ON DISCONNECT
  // ----------------------
  ws.on("close", () => {
    console.log("Client disconnected");

    if (role === "camera" && deviceID) {
      cameras.delete(deviceID);
      console.log(`Camera removed: ${deviceID}`);
    }

    if (role === "viewer" && deviceID) {
      const subs = viewers.get(deviceID);
      if (subs) {
        subs.delete(ws);

        console.log(`Viewer removed from ${deviceID}. Remaining: ${subs.size}`);

        // Tell camera to STOP when no more viewers
        if (subs.size === 0 && cameras.has(deviceID)) {
          cameras.get(deviceID).send("STOP_STREAM");
        }
      }
    }
  });
});


// ----------------------
// LISTEN (Render)
// ----------------------
const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log("Relay server running on", port);
});
