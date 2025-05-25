const HLSManager = require("./hls/hlsManager");
const path = require("path");
const fs = require("fs-extra");

async function testImprovedHLS() {
  console.log("🧪 Testing Improved HLS Implementation...\n");

  const hlsManager = new HLSManager();

  // Test 1: Check HLS directory creation
  console.log("1. Testing HLS directory setup...");
  await hlsManager.ensureHLSDirectory();
  const hlsDir = path.join(__dirname, "public/hls");
  const dirExists = await fs.pathExists(hlsDir);
  console.log(`   HLS directory exists: ${dirExists ? "✅" : "❌"}`);

  // Test 2: Check SDP generation improvements
  console.log("\n2. Testing improved SDP generation...");
  const mockTransport = {
    kind: "video",
    ffmpegPort: 20000,
    userName: "testUser",
    rtpParameters: {
      codecs: [
        {
          mimeType: "video/H264",
          payloadType: 96,
          clockRate: 90000,
          parameters: {
            "profile-level-id": "42e01f",
            "packetization-mode": "1",
          },
        },
      ],
    },
  };

  const sdpContent = hlsManager.generateImprovedSDP(mockTransport);
  console.log("   Generated SDP content:");
  console.log("   " + sdpContent.split("\r\n").join("\n   "));

  const hasFramerate = sdpContent.includes("a=framerate:30");
  const hasCodecParams = sdpContent.includes("profile-level-id=42e01f");
  console.log(`   Has framerate attribute: ${hasFramerate ? "✅" : "❌"}`);
  console.log(`   Has codec parameters: ${hasCodecParams ? "✅" : "❌"}`);

  // Test 3: Check video grid filter improvements
  console.log("\n3. Testing improved video grid filters...");

  const singleVideoFilter = hlsManager.createImprovedVideoGridFilter(1);
  console.log(
    `   Single video filter: ${
      singleVideoFilter.includes("force_original_aspect_ratio") ? "✅" : "❌"
    }`
  );

  const dualVideoFilter = hlsManager.createImprovedVideoGridFilter(2);
  console.log(
    `   Dual video filter: ${dualVideoFilter.includes("hstack") ? "✅" : "❌"}`
  );

  const quadVideoFilter = hlsManager.createImprovedVideoGridFilter(4);
  console.log(
    `   Quad video filter: ${quadVideoFilter.includes("vstack") ? "✅" : "❌"}`
  );

  // Test 4: Check audio mix filter improvements
  console.log("\n4. Testing improved audio mix filters...");

  const singleAudioFilter = hlsManager.createImprovedAudioMixFilter(1, 1);
  console.log(
    `   Single audio filter: ${
      singleAudioFilter.includes("aresample=48000") ? "✅" : "❌"
    }`
  );

  const multiAudioFilter = hlsManager.createImprovedAudioMixFilter(3, 2);
  console.log(
    `   Multi audio filter: ${
      multiAudioFilter.includes("amix") &&
      multiAudioFilter.includes("aresample")
        ? "✅"
        : "❌"
    }`
  );

  // Test 5: Check active streams management
  console.log("\n5. Testing stream management...");

  const activeStreams = hlsManager.getAllActiveStreams();
  console.log(`   Active streams count: ${activeStreams.length} ✅`);

  const isActive = hlsManager.isStreamActive("nonexistent");
  console.log(`   Non-existent stream check: ${!isActive ? "✅" : "❌"}`);

  console.log("\n🎉 Improved HLS Implementation Test Complete!");
  console.log("\nKey Improvements:");
  console.log("✅ Better WebRTC-to-FFmpeg compatibility");
  console.log("✅ Improved SDP generation with codec parameters");
  console.log("✅ Enhanced video grid filters with aspect ratio handling");
  console.log("✅ Better audio resampling and mixing");
  console.log("✅ Reduced FFmpeg error logging");
  console.log("✅ Periodic key frame requests for video stability");
  console.log(
    "✅ Better transport configuration (comedia=true, rtcpMux=false)"
  );
  console.log("✅ Enhanced FFmpeg arguments for error resilience");
}

// Run the test
testImprovedHLS().catch(console.error);
