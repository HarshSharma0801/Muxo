const HLSManager = require("./hls/hlsManager");
const mediasoup = require("mediasoup");
const config = require("./config/config");
const { spawn } = require("child_process");
const path = require("path");

// Mock room and producer setup for testing
class MockRoom {
  constructor() {
    this.roomName = "test-room";
    this.members = [];
    this.router = null;
  }

  addMockMember(videoProducer, audioProducer) {
    this.members.push({
      userName: "test-user",
      producer: {
        video: videoProducer,
        audio: audioProducer,
      },
    });
  }
}

async function testFullPipeline() {
  console.log(
    "🚀 Testing Full MediaSoup Pipeline: FFmpeg → MediaSoup → HLS...\n"
  );

  let worker, router, mockRoom, hlsManager;
  let ffmpegInjectProcess = null;

  try {
    // Create MediaSoup worker
    console.log("1. Creating MediaSoup worker...");
    worker = await mediasoup.createWorker({
      rtcMinPort: config.workerSettings.rtcMinPort,
      rtcMaxPort: config.workerSettings.rtcMaxPort,
      logLevel: config.workerSettings.logLevel,
      logTags: config.workerSettings.logTags,
    });

    worker.on("died", () => {
      console.error("❌ MediaSoup worker died");
      process.exit(1);
    });

    // Create router
    console.log("2. Creating MediaSoup router...");
    router = await worker.createRouter({
      mediaCodecs: config.routerMediaCodecs,
    });

    // Create mock room
    mockRoom = new MockRoom();
    mockRoom.router = router;

    // Create plain transports for FFmpeg injection
    console.log("3. Creating plain transports for FFmpeg injection...");

    // Video transport for injection
    const videoInjectTransport = await router.createPlainTransport({
      listenIp: {
        ip: "127.0.0.1",
        announcedIp: null,
      },
      rtcpMux: false,
      comedia: true,
    });

    // Audio transport for injection
    const audioInjectTransport = await router.createPlainTransport({
      listenIp: {
        ip: "127.0.0.1",
        announcedIp: null,
      },
      rtcpMux: false,
      comedia: true,
    });

    console.log(`Video inject port: ${videoInjectTransport.tuple.localPort}`);
    console.log(`Audio inject port: ${audioInjectTransport.tuple.localPort}`);

    // Create producers for injected media
    console.log("4. Creating producers for injected media...");

    const videoProducer = await videoInjectTransport.produce({
      kind: "video",
      rtpParameters: {
        codecs: [
          {
            mimeType: "video/H264",
            payloadType: 96,
            clockRate: 90000,
            parameters: {
              "packetization-mode": 1,
              "profile-level-id": "42e01f",
              "level-asymmetry-allowed": 1,
            },
            rtcpFeedback: [],
          },
        ],
        encodings: [{ ssrc: 11111111 }],
        headerExtensions: [],
      },
    });

    const audioProducer = await audioInjectTransport.produce({
      kind: "audio",
      rtpParameters: {
        codecs: [
          {
            mimeType: "audio/opus",
            payloadType: 111,
            clockRate: 48000,
            channels: 2,
            parameters: { "sprop-stereo": 1 },
            rtcpFeedback: [],
          },
        ],
        encodings: [{ ssrc: 22222222 }],
        headerExtensions: [],
      },
    });

    // Add mock member to room
    mockRoom.addMockMember(videoProducer, audioProducer);

    // Start FFmpeg injection
    console.log("5. Starting FFmpeg injection...");
    const ffmpegInjectArgs = [
      "-f",
      "lavfi",
      "-i",
      "testsrc2=size=640x480:rate=30",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=1000:sample_rate=48000",
      "-map",
      "0:v:0",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-tune",
      "zerolatency",
      "-pix_fmt",
      "yuv420p",
      "-map",
      "1:a:0",
      "-c:a",
      "libopus",
      "-b:a",
      "128k",
      "-ac",
      "2",
      "-ar",
      "48000",
      "-f",
      "tee",
      `[select=v:f=rtp:ssrc=11111111:payload_type=96]rtp://127.0.0.1:${videoInjectTransport.tuple.localPort}|[select=a:f=rtp:ssrc=22222222:payload_type=111]rtp://127.0.0.1:${audioInjectTransport.tuple.localPort}`,
    ];

    console.log("FFmpeg inject command:", ffmpegInjectArgs.join(" "));

    ffmpegInjectProcess = spawn("ffmpeg", ffmpegInjectArgs);

    ffmpegInjectProcess.stderr.on("data", (data) => {
      console.log(`FFmpeg inject: ${data}`);
    });

    ffmpegInjectProcess.on("close", (code) => {
      console.log(`FFmpeg inject process exited with code ${code}`);
    });

    // Wait for FFmpeg to start sending data
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Create HLS manager and start streaming
    console.log("6. Creating HLS manager...");
    hlsManager = new HLSManager();

    console.log("7. Starting HLS stream...");
    await hlsManager.startHLSStream("test-room", mockRoom);

    console.log("✅ HLS stream started successfully!");
    console.log(
      "📺 Stream should be available at: http://localhost:3030/api/hls/streams/test-room/playlist.m3u8"
    );

    // Let it run for 60 seconds
    console.log("⏱️  Running for 60 seconds...");
    setTimeout(async () => {
      console.log("8. Stopping processes...");

      if (ffmpegInjectProcess) {
        ffmpegInjectProcess.kill("SIGTERM");
      }

      if (hlsManager) {
        await hlsManager.stopHLSStream("test-room");
      }

      console.log("9. Closing MediaSoup resources...");
      videoProducer.close();
      audioProducer.close();
      videoInjectTransport.close();
      audioInjectTransport.close();
      router.close();
      worker.close();

      console.log("✅ Test completed successfully!");
      process.exit(0);
    }, 60000);
  } catch (error) {
    console.error("❌ Test failed:", error);

    // Cleanup on error
    if (ffmpegInjectProcess) {
      ffmpegInjectProcess.kill("SIGTERM");
    }

    if (hlsManager) {
      await hlsManager.stopHLSStream("test-room");
    }

    if (worker) {
      worker.close();
    }

    process.exit(1);
  }
}

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\n🛑 Received SIGINT, shutting down gracefully...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n🛑 Received SIGTERM, shutting down gracefully...");
  process.exit(0);
});

// Run the test
testFullPipeline();
