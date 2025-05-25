const fs = require("fs-extra");
const path = require("path");

async function monitorHLS(roomName = "demo") {
  const hlsDir = path.join(__dirname, "public/hls", roomName);

  console.log(`🔍 Monitoring HLS directory: ${hlsDir}`);
  console.log("Press Ctrl+C to stop monitoring\n");

  let lastFileCount = 0;
  let lastSegmentCount = 0;

  const checkFiles = async () => {
    try {
      if (await fs.pathExists(hlsDir)) {
        const files = await fs.readdir(hlsDir);
        const segments = files.filter((f) => f.endsWith(".ts"));
        const playlist = files.find((f) => f.endsWith(".m3u8"));

        if (
          files.length !== lastFileCount ||
          segments.length !== lastSegmentCount
        ) {
          console.log(
            `📁 Files: ${files.length}, Segments: ${
              segments.length
            }, Playlist: ${playlist ? "✅" : "❌"}`
          );

          if (playlist) {
            try {
              const playlistContent = await fs.readFile(
                path.join(hlsDir, playlist),
                "utf8"
              );
              const lines = playlistContent
                .split("\n")
                .filter((line) => line.trim());
              console.log(`📄 Playlist lines: ${lines.length}`);

              if (segments.length > 0) {
                console.log(
                  `🎉 HLS WORKING! ${segments.length} segments generated`
                );
              }
            } catch (e) {
              console.log(`⚠️  Could not read playlist: ${e.message}`);
            }
          }

          lastFileCount = files.length;
          lastSegmentCount = segments.length;
        }
      } else {
        if (lastFileCount > 0) {
          console.log("📁 HLS directory removed");
          lastFileCount = 0;
          lastSegmentCount = 0;
        }
      }
    } catch (error) {
      console.error("❌ Error monitoring:", error.message);
    }
  };

  // Check every 2 seconds
  const interval = setInterval(checkFiles, 2000);

  // Initial check
  await checkFiles();

  // Handle Ctrl+C
  process.on("SIGINT", () => {
    console.log("\n👋 Stopping monitor...");
    clearInterval(interval);
    process.exit(0);
  });
}

if (require.main === module) {
  const roomName = process.argv[2] || "demo";
  monitorHLS(roomName);
}

module.exports = { monitorHLS };
