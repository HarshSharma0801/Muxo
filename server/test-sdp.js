const fs = require("fs-extra");
const path = require("path");

async function testSDPGeneration() {
  console.log("🔍 Testing SDP file generation...");

  const hlsDir = path.join(__dirname, "public/hls");

  try {
    if (await fs.pathExists(hlsDir)) {
      const rooms = await fs.readdir(hlsDir);

      for (const room of rooms) {
        const roomPath = path.join(hlsDir, room);
        const stat = await fs.stat(roomPath);

        if (stat.isDirectory()) {
          console.log(`\n📺 Room: ${room}`);

          const files = await fs.readdir(roomPath);
          const sdpFiles = files.filter((f) => f.endsWith(".sdp"));

          console.log(`   SDP files: ${sdpFiles.length}`);

          for (const sdpFile of sdpFiles) {
            const sdpPath = path.join(roomPath, sdpFile);
            const content = await fs.readFile(sdpPath, "utf8");

            console.log(`   📄 ${sdpFile}:`);
            console.log(content);
            console.log("   ---");
          }
        }
      }
    } else {
      console.log("❌ HLS directory not found");
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

// Test simple FFmpeg command
function testSimpleFFmpegCommand() {
  console.log("\n🧪 Testing simple FFmpeg command structure...");

  const args = [
    "-loglevel",
    "info",
    "-y",
    "-protocol_whitelist",
    "file,udp,rtp",
    "-f",
    "sdp",
    "-i",
    "test_video.sdp",
    "-map",
    "0:v:0",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-tune",
    "zerolatency",
    "-f",
    "hls",
    "-hls_time",
    "2",
    "-hls_list_size",
    "10",
    "-hls_flags",
    "delete_segments",
    "-hls_allow_cache",
    "0",
    "output.m3u8",
  ];

  console.log("FFmpeg command:");
  console.log(`ffmpeg ${args.join(" ")}`);
}

if (require.main === module) {
  testSDPGeneration();
  testSimpleFFmpegCommand();
}

module.exports = { testSDPGeneration };
