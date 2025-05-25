const { spawn } = require("child_process");
const fs = require("fs-extra");
const path = require("path");

// Test if we can create a simple HLS stream with test input
async function testSimpleHLS() {
  console.log("🧪 Testing simple HLS generation with test input...");

  const outputDir = path.join(__dirname, "test-hls");
  await fs.ensureDir(outputDir);

  const outputPath = path.join(outputDir, "test.m3u8");

  // Simple test with testsrc
  const ffmpegArgs = [
    "-f",
    "lavfi",
    "-i",
    "testsrc2=size=1280x720:rate=30",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-tune",
    "zerolatency",
    "-t",
    "10", // 10 seconds
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
    outputPath,
  ];

  console.log(`🚀 FFmpeg test command: ffmpeg ${ffmpegArgs.join(" ")}`);

  return new Promise((resolve) => {
    const ffmpeg = spawn("ffmpeg", ffmpegArgs);

    ffmpeg.stderr.on("data", (data) => {
      const output = data.toString();
      if (output.includes("frame=")) {
        console.log("📹 Processing frames...");
      } else if (output.includes("error") || output.includes("Error")) {
        console.error("❌ FFmpeg error:", output);
      }
    });

    ffmpeg.on("close", async (code) => {
      console.log(`FFmpeg test exited with code: ${code}`);

      // Check if files were created
      try {
        if (await fs.pathExists(outputPath)) {
          console.log("✅ HLS playlist created!");

          const files = await fs.readdir(outputDir);
          const segments = files.filter((f) => f.endsWith(".ts"));
          console.log(`✅ Generated ${segments.length} segments`);

          if (segments.length > 0) {
            console.log("🎉 HLS generation is working!");
          }
        } else {
          console.log("❌ No HLS playlist found");
        }
      } catch (error) {
        console.error("❌ Error checking files:", error.message);
      }

      resolve(code === 0);
    });
  });
}

// Test RTP reception
async function testRTPReception() {
  console.log("\n🔍 Testing RTP reception...");

  // Create a simple SDP file for testing
  const testSDP = `v=0
o=- 0 0 IN IP4 127.0.0.1
s=Test RTP Stream
c=IN IP4 127.0.0.1
t=0 0
m=video 25000 RTP/AVP 96
a=rtpmap:96 H264/90000
a=sendonly`;

  const sdpPath = path.join(__dirname, "test-rtp.sdp");
  await fs.writeFile(sdpPath, testSDP);

  console.log("📄 Created test SDP file");
  console.log("🎯 To test RTP reception, run:");
  console.log(
    `ffmpeg -protocol_whitelist file,udp,rtp -f sdp -i ${sdpPath} -t 5 test-output.mp4`
  );

  return true;
}

async function runTests() {
  console.log("🧪 Running HLS and RTP tests...\n");

  // Test 1: Simple HLS generation
  const hlsWorks = await testSimpleHLS();

  // Test 2: RTP setup
  await testRTPReception();

  console.log("\n📋 Test Summary:");
  console.log(`HLS Generation: ${hlsWorks ? "✅ Working" : "❌ Failed"}`);
  console.log("RTP Reception: 🔍 Manual test required");

  if (hlsWorks) {
    console.log("\n✅ FFmpeg and HLS are working correctly!");
    console.log("🔍 The issue is likely with RTP data flow from MediaSoup");
  } else {
    console.log("\n❌ Basic FFmpeg/HLS setup has issues");
  }
}

if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { testSimpleHLS, testRTPReception };
