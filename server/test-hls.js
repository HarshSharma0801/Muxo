const HLSManager = require("./hls/hlsManager");

async function testHLS() {
  console.log("Testing HLS Manager...");

  const hlsManager = new HLSManager();

  try {
    // Test creating a test stream
    console.log('Starting test stream for room "test-room"...');
    await hlsManager.startHLSStream("test-room", null);

    // Wait a bit
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Check if stream is active
    const isActive = hlsManager.isStreamActive("test-room");
    console.log("Stream active:", isActive);

    // Get stream info
    const streamInfo = hlsManager.getStreamInfo("test-room");
    console.log("Stream info:", streamInfo);

    // List all streams
    const allStreams = hlsManager.getAllActiveStreams();
    console.log("All active streams:", allStreams);

    // Stop the stream
    console.log("Stopping test stream...");
    await hlsManager.stopHLSStream("test-room");

    console.log("HLS test completed successfully!");
  } catch (error) {
    console.error("HLS test failed:", error);
  }
}

// Run the test
testHLS();
