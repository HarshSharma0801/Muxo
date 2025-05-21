const http = require("http");
const express = require("express");
const socketio = require("socket.io");
const createWorkers = require("./media-helpers/createWorkers");
const setupSocketHandlers = require("./sockets");
const config = require("./config/config");

const app = express();
app.use(express.json({}));

const httpServer = http.createServer(app);
const io = socketio(httpServer, {
  cors: ["*"],
});

let workers = null;
let rooms = [];

app.get("/", (req, res) => {
  res.send("Server is running fine !!!!");
});

const initMediaSoup = async () => {
  try {
    workers = await createWorkers();

    setupSocketHandlers(io, rooms, workers);

    httpServer.listen(3030, () => {
      console.log(`Server started on port 3030`);
    });
  } catch (error) {
    console.error("Failed to initialize MediaSoup:", error);
    process.exit(1);
  }
};

// Initialize MediaSoup
initMediaSoup();
