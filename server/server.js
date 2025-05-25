const http = require("http");
const express = require("express");
const socketio = require("socket.io");
const cors = require("cors");
const path = require("path");
const createWorkers = require("./media-helpers/createWorkers");
const setupSocketHandlers = require("./sockets");
const config = require("./config/config");
const HLSManager = require("./hls/hlsManager");
const createHLSRoutes = require("./routes/hlsRoutes");

const app = express();

// Middleware
app.use(cors());
app.use(express.json({}));

// Serve static files for HLS
app.use("/hls", express.static(path.join(__dirname, "public/hls")));

const httpServer = http.createServer(app);
const io = socketio(httpServer, {
  cors: ["*"],
});

let workers = null;
let rooms = [];
let hlsManager = null;

app.get("/", (req, res) => {
  res.send("Server is running fine !!!!");
});

const initMediaSoup = async () => {
  try {
    workers = await createWorkers();
    hlsManager = new HLSManager();

    // Setup HLS routes
    app.use("/api/hls", createHLSRoutes(hlsManager));

    setupSocketHandlers(io, rooms, workers, hlsManager);

    httpServer.listen(3030, () => {
      console.log(`Server started on port 3030`);
      console.log(
        `HLS streams available at: http://localhost:3030/api/hls/streams`
      );
    });
  } catch (error) {
    console.error("Failed to initialize MediaSoup:", error);
    process.exit(1);
  }
};

// Initialize MediaSoup
initMediaSoup();
