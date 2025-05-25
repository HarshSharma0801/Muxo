const express = require("express");
const path = require("path");
const fs = require("fs-extra");

const createHLSRoutes = (hlsManager) => {
  const router = express.Router();

  // Get list of available streams
  router.get("/streams", (req, res) => {
    const activeStreams = hlsManager.getAllActiveStreams();
    res.json({ streams: activeStreams });
  });

  // Get stream info
  router.get("/streams/:roomName/info", (req, res) => {
    const { roomName } = req.params;
    const streamInfo = hlsManager.getStreamInfo(roomName);

    if (!streamInfo) {
      return res.status(404).json({ error: "Stream not found" });
    }

    res.json({
      roomName: streamInfo.roomName,
      isActive: streamInfo.isActive,
      startTime: streamInfo.startTime,
      playlistUrl: `/api/hls/streams/${roomName}/playlist.m3u8`,
    });
  });

  // Serve HLS playlist
  router.get("/streams/:roomName/playlist.m3u8", async (req, res) => {
    const { roomName } = req.params;
    const streamInfo = hlsManager.getStreamInfo(roomName);

    if (!streamInfo || !streamInfo.isActive) {
      return res.status(404).json({ error: "Stream not found or inactive" });
    }

    const playlistPath = streamInfo.playlistPath;

    try {
      const exists = await fs.pathExists(playlistPath);
      if (!exists) {
        return res.status(404).json({ error: "Playlist not found" });
      }

      res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      res.setHeader("Access-Control-Allow-Origin", "*");

      res.sendFile(playlistPath);
    } catch (error) {
      console.error("Error serving playlist:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Serve HLS segments
  router.get("/streams/:roomName/:segment", async (req, res) => {
    const { roomName, segment } = req.params;
    const streamInfo = hlsManager.getStreamInfo(roomName);

    if (!streamInfo || !streamInfo.isActive) {
      return res.status(404).json({ error: "Stream not found or inactive" });
    }

    const segmentPath = path.join(streamInfo.streamDir, segment);

    try {
      const exists = await fs.pathExists(segmentPath);
      if (!exists) {
        return res.status(404).json({ error: "Segment not found" });
      }

      res.setHeader("Content-Type", "video/mp2t");
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.setHeader("Access-Control-Allow-Origin", "*");

      res.sendFile(segmentPath);
    } catch (error) {
      console.error("Error serving segment:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Start HLS stream for a room (manual trigger for testing)
  router.post("/streams/:roomName/start", async (req, res) => {
    const { roomName } = req.params;

    try {
      // This would typically be called automatically when producers join
      // For now, we'll create a test stream
      await hlsManager.startHLSStream(roomName, null);
      res.json({ message: `HLS stream started for room: ${roomName}` });
    } catch (error) {
      console.error("Error starting HLS stream:", error);
      res.status(500).json({ error: "Failed to start HLS stream" });
    }
  });

  // Stop HLS stream for a room
  router.post("/streams/:roomName/stop", async (req, res) => {
    const { roomName } = req.params;

    try {
      await hlsManager.stopHLSStream(roomName);
      res.json({ message: `HLS stream stopped for room: ${roomName}` });
    } catch (error) {
      console.error("Error stopping HLS stream:", error);
      res.status(500).json({ error: "Failed to stop HLS stream" });
    }
  });

  return router;
};

module.exports = createHLSRoutes;
