const HLSManager = require("./hls/hlsManager");
const mediasoup = require("mediasoup");
const config = require("./config/config");

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

async function testRealHLSStreaming() {
  console.log("🚀 Testing Real MediaSoup RTP to HLS Streaming...\n");

  try {
    // Create MediaSoup worker
    console.log("1. Creating MediaSoup worker...");
    const worker = await mediasoup.createWorker({
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
    const router = await worker.createRouter({
      mediaCodecs: config.routerMediaCodecs,
    });

    // Create mock room
    const mockRoom = new MockRoom();
    mockRoom.router = router;

    // Create WebRTC transport for mock producer
    console.log("3. Creating WebRTC transport...");
    const webRtcTransport = await router.createWebRtcTransport({
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
      listenInfos: config.webRtcTransport.listenIps,
      initialAvailableOutgoingBitrate:
        config.webRtcTransport.initialAvailableOutgoingBitrate,
    });

    // Create mock video producer
    console.log("4. Creating mock video producer...");
    const videoProducer = await webRtcTransport.produce({
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

    // Create mock audio producer
    console.log("5. Creating mock audio producer...");
    const audioProducer = await webRtcTransport.produce({
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

    // Create HLS manager and start streaming
    console.log("6. Creating HLS manager...");
    const hlsManager = new HLSManager();

    console.log("7. Starting HLS stream...");
    await hlsManager.startHLSStream("test-room", mockRoom);

    console.log("✅ HLS stream started successfully!");
    console.log(
      "📺 Stream should be available at: http://localhost:3030/api/hls/streams/test-room/playlist.m3u8"
    );

    // Let it run for 30 seconds
    console.log("⏱️  Running for 30 seconds...");
    setTimeout(async () => {
      console.log("8. Stopping HLS stream...");
      await hlsManager.stopHLSStream("test-room");

      console.log("9. Closing MediaSoup resources...");
      videoProducer.close();
      audioProducer.close();
      webRtcTransport.close();
      router.close();
      worker.close();

      console.log("✅ Test completed successfully!");
      process.exit(0);
    }, 30000);
  } catch (error) {
    console.error("❌ Test failed:", error);
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
testRealHLSStreaming();
