import express from "express";
import http from "http";
import { WebSocketServer } from "ws";

const app = express();
const server = http.createServer(app);

let viewers = 0;    // Count viewers
let esp32 = null;   // Store ESP32 WebSocket connection

const wss = new WebSocketServer({
  server,
  path: "/ws"
});

app.get("/", (req, res) => {
  res.send("ESP32-CAM Relay Online");
});

wss.on("connection", (ws) => {
  console.log("Client connected");

  ws.on("message", (data, isBinary) => {
    // Viewer → Server commands
    if (!isBinary) {
      const msg = data.toString();

      if (msg === "viewer_join") {
        viewers++;
        console.log("Viewer joined:", viewers);

        if (esp32)
          esp32.send("start");
      }

      if (msg === "viewer_leave") {
        viewers--;
        console.log("Viewer left:", viewers);

        if (viewers <= 0 && esp32)
          esp32.send("stop");
      }

      return;
    }

    // ESP32 sending binary frame
    if (ws === esp32) {
      wss.clients.forEach(client => {
        if (client !== ws && client.readyState === client.OPEN) {
          client.send(data, { binary: true });
        }
      });
    }
  });

  ws.on("close", () => {
    if (ws === esp32) {
      console.log("ESP32 disconnected");
      esp32 = null;
    }
  });

  // Identify ESP32
  ws.send("who");
  ws.once("message", id => {
    if (id.toString() === "esp32") {
      esp32 = ws;
      console.log("ESP32 registered!");
    }
  });

});

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log("Relay running on port", port);
});
