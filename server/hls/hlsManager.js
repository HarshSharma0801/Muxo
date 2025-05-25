const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs-extra");
const path = require("path");
const { spawn } = require("child_process");

class HLSManager {
  constructor() {
    this.activeStreams = new Map(); // roomName -> stream info
    this.hlsDir = path.join(__dirname, "../public/hls");
    this.ensureHLSDirectory();
  }

  async ensureHLSDirectory() {
    await fs.ensureDir(this.hlsDir);
  }

  async startHLSStream(roomName, room) {
    if (this.activeStreams.has(roomName)) {
      console.log(
        `🔄 HLS stream already active for room: ${roomName}, updating...`
      );
      return await this.updateStream(roomName, room);
    }

    const streamDir = path.join(this.hlsDir, roomName);
    await fs.ensureDir(streamDir);

    // Get active producers in the room
    const producers = this.getActiveProducers(room);
    if (producers.length === 0) {
      console.log(`No active producers in room: ${roomName}`);
      return;
    }

    console.log(
      `🎬 Starting HLS stream for room: ${roomName} with ${producers.length} producers`
    );
    producers.forEach((p, i) => {
      console.log(
        `   ${i + 1}. ${
          p.participant.userName
        } - Video: ${!!p.videoProducer}, Audio: ${!!p.audioProducer}`
      );
    });

    const streamInfo = {
      roomName,
      streamDir,
      playlistPath: path.join(streamDir, "playlist.m3u8"),
      isActive: true,
      startTime: Date.now(),
      plainTransports: [],
      consumers: [],
      producerCount: producers.length,
      videoTransports: [],
      audioTransports: [],
    };

    this.activeStreams.set(roomName, streamInfo);

    try {
      // Create plain transports and consumers for each producer
      await this.setupPlainTransports(streamInfo, room, producers);

      // Start FFmpeg BEFORE resuming consumers to ensure it's ready to receive data
      console.log(`🎬 Starting FFmpeg process...`);
      await this.startMultiProducerFFmpeg(streamInfo);

      // Wait for FFmpeg to initialize
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Resume consumers and request key frames
      console.log(`🔄 Resuming consumers and requesting key frames...`);
      let resumedCount = 0;
      for (const consumer of streamInfo.consumers) {
        try {
          if (!consumer.closed) {
            await consumer.resume();

            // For video consumers, request key frames immediately and periodically
            if (consumer.kind === "video") {
              await consumer.requestKeyFrame();

              // Set up periodic key frame requests
              const keyFrameInterval = setInterval(async () => {
                try {
                  if (!consumer.closed) {
                    await consumer.requestKeyFrame();
                  } else {
                    clearInterval(keyFrameInterval);
                  }
                } catch (error) {
                  clearInterval(keyFrameInterval);
                }
              }, 2000); // Request key frame every 2 seconds

              consumer._keyFrameInterval = keyFrameInterval;
            }

            resumedCount++;
            console.log(
              `   ✅ Resumed ${consumer.kind} consumer for ${consumer.producerId}`
            );
          }
        } catch (error) {
          console.warn(
            `   ⚠️  Could not resume consumer ${consumer.id}:`,
            error.message
          );
        }
      }
      console.log(
        `✅ Resumed ${resumedCount}/${streamInfo.consumers.length} consumers`
      );

      console.log(`✅ Started HLS stream for room: ${roomName}`);
    } catch (error) {
      console.error(`Failed to start HLS stream for room ${roomName}:`, error);
      await this.stopHLSStream(roomName);
      throw error;
    }
  }

  async setupPlainTransports(streamInfo, room, producers) {
    const { roomName } = streamInfo;

    for (let i = 0; i < producers.length; i++) {
      const producerInfo = producers[i];
      const { participant, videoProducer, audioProducer } = producerInfo;

      // Setup video transport if video producer exists
      if (videoProducer) {
        const videoTransportInfo = await this.createPlainTransportForProducer(
          room.router,
          videoProducer,
          "video",
          i,
          participant.userName
        );
        streamInfo.plainTransports.push(videoTransportInfo);
        streamInfo.videoTransports.push(videoTransportInfo);
        streamInfo.consumers.push(videoTransportInfo.consumer);
      }

      // Setup audio transport if audio producer exists
      if (audioProducer) {
        const audioTransportInfo = await this.createPlainTransportForProducer(
          room.router,
          audioProducer,
          "audio",
          i,
          participant.userName
        );
        streamInfo.plainTransports.push(audioTransportInfo);
        streamInfo.audioTransports.push(audioTransportInfo);
        streamInfo.consumers.push(audioTransportInfo.consumer);
      }
    }

    console.log(
      `Created ${streamInfo.videoTransports.length} video and ${streamInfo.audioTransports.length} audio transports for room: ${roomName}`
    );
  }

  async createPlainTransportForProducer(
    router,
    producer,
    kind,
    index,
    userName
  ) {
    // Create plain transport for RTP out
    const plainTransport = await router.createPlainTransport({
      listenIp: {
        ip: "127.0.0.1",
        announcedIp: null,
      },
      rtcpMux: false, // Disable RTCP mux for better compatibility
      comedia: false, // We need to specify the connection details
      enableSctp: false,
      enableSrtp: false,
    });

    // Get router capabilities and filter for the specific codec
    const routerCodecs = router.rtpCapabilities.codecs.filter(
      (codec) => codec.kind === kind
    );

    // Create RTP capabilities for the consumer with specific codec preferences
    const rtpCapabilities = {
      codecs:
        kind === "video"
          ? routerCodecs.filter(
              (codec) =>
                codec.mimeType.toLowerCase() === "video/h264" ||
                codec.mimeType.toLowerCase() === "video/vp8"
            )
          : routerCodecs.filter(
              (codec) =>
                codec.mimeType.toLowerCase() === "audio/opus" ||
                codec.mimeType.toLowerCase() === "audio/pcmu" ||
                codec.mimeType.toLowerCase() === "audio/pcma"
            ),
      headerExtensions: router.rtpCapabilities.headerExtensions.filter(
        (ext) => ext.kind === kind || ext.kind === undefined
      ),
    };

    // Create consumer on the plain transport
    const consumer = await plainTransport.consume({
      producerId: producer.id,
      rtpCapabilities,
      paused: true,
    });

    // Use a more reliable port allocation strategy
    const basePort = kind === "video" ? 20000 : 30000;
    const ffmpegPort = basePort + index * 10 + (Date.now() % 100);

    // Connect the transport to send RTP to FFmpeg
    await plainTransport.connect({
      ip: "127.0.0.1",
      port: ffmpegPort,
    });

    // Get the local port assigned by MediaSoup
    const localPort = plainTransport.tuple.localPort;

    console.log(
      `Created ${kind} transport for ${userName} (${index}): MediaSoup port ${localPort} → FFmpeg port ${ffmpegPort}`
    );
    console.log(`   Codec: ${consumer.rtpParameters.codecs[0].mimeType}`);

    return {
      transport: plainTransport,
      consumer,
      kind,
      localPort,
      ffmpegPort,
      rtpParameters: consumer.rtpParameters,
      producerId: producer.id,
      userName,
      index,
    };
  }

  getActiveProducers(room) {
    const producers = [];
    if (!room || !room.members) {
      return producers;
    }

    room.members.forEach((member) => {
      if (member.producer.video || member.producer.audio) {
        producers.push({
          participant: member,
          videoProducer: member.producer.video,
          audioProducer: member.producer.audio,
        });
      }
    });
    return producers;
  }

  // 🎬 NEW: Multi-producer FFmpeg with proper WebRTC handling
  async startMultiProducerFFmpeg(streamInfo) {
    const { roomName, streamDir, videoTransports, audioTransports } =
      streamInfo;
    const outputPath = path.join(streamDir, "playlist.m3u8");

    if (videoTransports.length === 0 && audioTransports.length === 0) {
      throw new Error("No video or audio transports available for FFmpeg");
    }

    console.log(`🎬 Starting multi-producer FFmpeg for room ${roomName}:`);
    console.log(`   Video inputs: ${videoTransports.length}`);
    console.log(`   Audio inputs: ${audioTransports.length}`);

    // Generate SDP files for each transport
    await this.generateMultiSDPFiles(streamInfo);

    // Use improved FFmpeg handling
    return this.startImprovedFFmpeg(streamInfo);
  }

  async startImprovedFFmpeg(streamInfo) {
    const { roomName, streamDir, videoTransports, audioTransports } =
      streamInfo;
    const outputPath = path.join(streamDir, "playlist.m3u8");

    console.log(`🎬 Starting IMPROVED FFmpeg for room ${roomName}`);

    // Build FFmpeg arguments with better error handling and codec support
    const ffmpegArgs = [
      "-loglevel",
      "warning", // Reduce log verbosity
      "-y", // Overwrite output files
      "-fflags",
      "+genpts", // Generate presentation timestamps
      "-avoid_negative_ts",
      "make_zero", // Handle negative timestamps
      "-max_delay",
      "5000000", // 5 second max delay
    ];

    // Add video inputs with proper buffering
    for (const transport of videoTransports) {
      ffmpegArgs.push(
        "-protocol_whitelist",
        "file,udp,rtp",
        "-thread_queue_size",
        "1024",
        "-f",
        "sdp",
        "-i",
        transport.sdpPath
      );
    }

    // Add audio inputs with proper buffering
    for (const transport of audioTransports) {
      ffmpegArgs.push(
        "-protocol_whitelist",
        "file,udp,rtp",
        "-thread_queue_size",
        "1024",
        "-f",
        "sdp",
        "-i",
        transport.sdpPath
      );
    }

    // Create filter complex for video and audio processing
    let filterComplex = "";
    let hasVideo = videoTransports.length > 0;
    let hasAudio = audioTransports.length > 0;

    if (hasVideo) {
      if (videoTransports.length === 1) {
        // Single video: scale and add error resilience
        filterComplex +=
          "[0:v]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,fps=30[video_out]";
      } else {
        // Multiple videos: create grid
        filterComplex += this.createImprovedVideoGridFilter(
          videoTransports.length
        );
      }

      ffmpegArgs.push(
        "-map",
        hasVideo && videoTransports.length === 1 ? "[video_out]" : "[composed]"
      );
      ffmpegArgs.push(
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-tune",
        "zerolatency",
        "-profile:v",
        "baseline", // Better compatibility
        "-level",
        "3.1",
        "-pix_fmt",
        "yuv420p",
        "-g",
        "60", // GOP size
        "-keyint_min",
        "30",
        "-sc_threshold",
        "0",
        "-b:v",
        "2000k",
        "-maxrate",
        "2500k",
        "-bufsize",
        "4000k"
      );
    }

    if (hasAudio) {
      const audioInputOffset = videoTransports.length;
      if (audioTransports.length === 1) {
        filterComplex += hasVideo ? ";" : "";
        filterComplex += `[${audioInputOffset}:a]aresample=48000,volume=1.0[audio_out]`;
      } else {
        filterComplex += hasVideo ? ";" : "";
        filterComplex += this.createImprovedAudioMixFilter(
          audioTransports.length,
          audioInputOffset
        );
      }

      ffmpegArgs.push(
        "-map",
        hasAudio && audioTransports.length === 1
          ? "[audio_out]"
          : "[mixed_audio]"
      );
      ffmpegArgs.push(
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        "-ar",
        "48000",
        "-ac",
        "2"
      );
    }

    if (filterComplex) {
      ffmpegArgs.push("-filter_complex", filterComplex);
    }

    // HLS output settings with better error resilience
    ffmpegArgs.push(
      "-f",
      "hls",
      "-hls_time",
      "2",
      "-hls_list_size",
      "10",
      "-hls_flags",
      "delete_segments+independent_segments",
      "-hls_allow_cache",
      "0",
      "-hls_segment_type",
      "mpegts",
      "-start_number",
      "0",
      outputPath
    );

    return this.executeFFmpeg(streamInfo, ffmpegArgs);
  }

  createImprovedVideoGridFilter(videoCount) {
    console.log(`🎨 Creating improved video grid for ${videoCount} streams...`);

    if (videoCount === 1) {
      return "[0:v]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,fps=30[composed]";
    }

    if (videoCount === 2) {
      return "[0:v]scale=640:720:force_original_aspect_ratio=decrease,pad=640:720:(ow-iw)/2:(oh-ih)/2,fps=30[v0];[1:v]scale=640:720:force_original_aspect_ratio=decrease,pad=640:720:(ow-iw)/2:(oh-ih)/2,fps=30[v1];[v0][v1]hstack=inputs=2[composed]";
    }

    if (videoCount === 3) {
      return "[0:v]scale=640:360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2,fps=30[v0];[1:v]scale=640:360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2,fps=30[v1];[2:v]scale=640:360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2,fps=30[v2];color=black:640x360:d=1[black];[v0][v1]hstack=inputs=2[top];[v2][black]hstack=inputs=2[bottom];[top][bottom]vstack=inputs=2[composed]";
    }

    if (videoCount === 4) {
      return "[0:v]scale=640:360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2,fps=30[v0];[1:v]scale=640:360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2,fps=30[v1];[2:v]scale=640:360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2,fps=30[v2];[3:v]scale=640:360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2,fps=30[v3];[v0][v1]hstack=inputs=2[top];[v2][v3]hstack=inputs=2[bottom];[top][bottom]vstack=inputs=2[composed]";
    }

    // Fallback
    return "[0:v]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,fps=30[composed]";
  }

  createImprovedAudioMixFilter(audioCount, audioInputOffset) {
    if (audioCount === 0) {
      return "anullsrc=channel_layout=stereo:sample_rate=48000[mixed_audio]";
    }

    if (audioCount === 1) {
      return `[${audioInputOffset}:a]aresample=48000,volume=1.0[mixed_audio]`;
    }

    // For multiple audio streams, use proper mixing with resampling
    const inputs = [];
    for (let i = 0; i < Math.min(audioCount, 4); i++) {
      inputs.push(`[${audioInputOffset + i}:a]`);
    }

    return `${inputs.join("")}amix=inputs=${Math.min(
      audioCount,
      4
    )}:duration=longest:dropout_transition=2,aresample=48000[mixed_audio]`;
  }

  async executeFFmpeg(streamInfo, ffmpegArgs) {
    const { roomName } = streamInfo;

    console.log(`🚀 FFmpeg command: ffmpeg ${ffmpegArgs.join(" ")}`);

    const ffmpegProcess = spawn("ffmpeg", ffmpegArgs, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    ffmpegProcess.stdout.on("data", (data) => {
      const output = data.toString();
      console.log(`FFmpeg stdout for ${roomName}: ${output}`);
    });

    ffmpegProcess.stderr.on("data", (data) => {
      const output = data.toString();

      // Filter out common non-critical messages
      if (
        output.includes("frame=") ||
        output.includes("fps=") ||
        output.includes("bitrate=")
      ) {
        // Progress info - only log occasionally
        if (Math.random() < 0.1) {
          // 10% chance to log progress
          console.log(`FFmpeg [${roomName}]: Processing...`);
        }
      } else if (
        output.includes("Input #") ||
        output.includes("Output #") ||
        output.includes("Stream mapping") ||
        output.includes("encoder") ||
        output.includes("muxer")
      ) {
        console.log(`FFmpeg INFO for ${roomName}: ${output.trim()}`);
      } else if (
        output.includes("error") ||
        output.includes("Error") ||
        output.includes("failed") ||
        output.includes("decode_slice_header") ||
        output.includes("non-existing PPS")
      ) {
        // Only log errors if they're not the repetitive H.264 errors
        if (
          !output.includes("decode_slice_header") &&
          !output.includes("non-existing PPS")
        ) {
          console.error(`FFmpeg ERROR for ${roomName}: ${output.trim()}`);
        }
      }
    });

    ffmpegProcess.on("close", (code) => {
      console.log(`FFmpeg process for ${roomName} exited with code ${code}`);
      if (code !== 0 && code !== null) {
        console.error(
          `FFmpeg failed for room ${roomName} with exit code ${code}`
        );
      }
      this.stopHLSStream(roomName);
    });

    ffmpegProcess.on("error", (error) => {
      console.error(`FFmpeg process error for ${roomName}:`, error.message);
      this.stopHLSStream(roomName);
    });

    streamInfo.ffmpegProcess = ffmpegProcess;

    console.log(`✅ Started FFmpeg process for room: ${roomName}`);
  }

  async generateMultiSDPFiles(streamInfo) {
    const { streamDir, videoTransports, audioTransports } = streamInfo;

    // Generate SDP for each video transport
    for (let i = 0; i < videoTransports.length; i++) {
      const transport = videoTransports[i];
      const sdpContent = this.generateImprovedSDP(transport);
      const sdpPath = path.join(
        streamDir,
        `video_${i}_${transport.userName}.sdp`
      );

      await fs.writeFile(sdpPath, sdpContent);
      transport.sdpPath = sdpPath;
      console.log(`   Generated video SDP: ${transport.userName}`);
    }

    // Generate SDP for each audio transport
    for (let i = 0; i < audioTransports.length; i++) {
      const transport = audioTransports[i];
      const sdpContent = this.generateImprovedSDP(transport);
      const sdpPath = path.join(
        streamDir,
        `audio_${i}_${transport.userName}.sdp`
      );

      await fs.writeFile(sdpPath, sdpContent);
      transport.sdpPath = sdpPath;
      console.log(`   Generated audio SDP: ${transport.userName}`);
    }
  }

  generateImprovedSDP(transport) {
    const { kind, ffmpegPort, rtpParameters } = transport;
    const codec = rtpParameters.codecs[0];

    let sdp = `v=0\r\n`;
    sdp += `o=- 0 0 IN IP4 127.0.0.1\r\n`;
    sdp += `s=MediaSoup ${kind} Stream - ${transport.userName}\r\n`;
    sdp += `c=IN IP4 127.0.0.1\r\n`;
    sdp += `t=0 0\r\n`;

    sdp += `m=${kind} ${ffmpegPort} RTP/AVP ${codec.payloadType}\r\n`;
    sdp += `a=rtpmap:${codec.payloadType} ${codec.mimeType.replace(
      `${kind}/`,
      ""
    )}/${codec.clockRate}`;

    if (kind === "audio" && codec.channels && codec.channels > 1) {
      sdp += `/${codec.channels}`;
    }

    sdp += `\r\n`;

    // Add codec-specific parameters
    if (codec.parameters) {
      const params = Object.entries(codec.parameters)
        .map(([key, value]) => `${key}=${value}`)
        .join(";");
      if (params) {
        sdp += `a=fmtp:${codec.payloadType} ${params}\r\n`;
      }
    }

    // Add additional attributes for better compatibility
    sdp += `a=sendonly\r\n`;

    if (kind === "video") {
      sdp += `a=framerate:30\r\n`;
    }

    return sdp;
  }

  async updateStream(roomName, room) {
    const streamInfo = this.activeStreams.get(roomName);
    if (!streamInfo) {
      return await this.startHLSStream(roomName, room);
    }

    const currentProducers = this.getActiveProducers(room);

    // If no producers, stop the stream
    if (currentProducers.length === 0) {
      console.log(`🛑 No producers left in room ${roomName}, stopping stream`);
      return await this.stopHLSStream(roomName);
    }

    // Count video and audio producers separately
    const currentVideoCount = currentProducers.filter(
      (p) => p.videoProducer
    ).length;
    const currentAudioCount = currentProducers.filter(
      (p) => p.audioProducer
    ).length;
    const existingVideoCount = streamInfo.videoTransports?.length || 0;
    const existingAudioCount = streamInfo.audioTransports?.length || 0;

    // Only restart if video producer count changes (audio changes are less critical)
    if (currentVideoCount !== existingVideoCount) {
      console.log(
        `🔄 Video producer count changed for room ${roomName}: ${existingVideoCount} → ${currentVideoCount}`
      );

      // Ensure complete cleanup before restart
      await this.stopHLSStream(roomName);

      // Wait longer to ensure ports are released
      console.log(`⏳ Waiting for port cleanup...`);
      setTimeout(async () => {
        try {
          await this.startHLSStream(roomName, room);
          console.log(`✅ Restarted HLS stream for room ${roomName}`);
        } catch (error) {
          console.error(
            `❌ Failed to restart HLS stream for room ${roomName}:`,
            error
          );
        }
      }, 5000); // Increased wait time
      return;
    }

    // If only audio count changed, just log it (could implement dynamic audio mixing later)
    if (currentAudioCount !== existingAudioCount) {
      console.log(
        `🎵 Audio producer count changed for room ${roomName}: ${existingAudioCount} → ${currentAudioCount} (keeping existing stream)`
      );
    }

    console.log(`✅ Stream for room ${roomName} is up to date`);
  }

  async stopHLSStream(roomName) {
    const streamInfo = this.activeStreams.get(roomName);
    if (!streamInfo) {
      return;
    }

    console.log(`🛑 Stopping HLS stream for room: ${roomName}`);

    try {
      // Stop FFmpeg process first
      if (streamInfo.ffmpegProcess && !streamInfo.ffmpegProcess.killed) {
        console.log(`   Stopping FFmpeg process...`);
        streamInfo.ffmpegProcess.kill("SIGTERM");

        // Wait a bit for graceful shutdown
        await new Promise((resolve) => setTimeout(resolve, 1000));

        if (!streamInfo.ffmpegProcess.killed) {
          console.log(`   Force killing FFmpeg process...`);
          streamInfo.ffmpegProcess.kill("SIGKILL");
        }
      }

      // Clear key frame intervals and close all consumers
      console.log(
        `   Closing ${streamInfo.consumers?.length || 0} consumers...`
      );
      for (const consumer of streamInfo.consumers || []) {
        try {
          // Clear key frame interval if it exists
          if (consumer._keyFrameInterval) {
            clearInterval(consumer._keyFrameInterval);
            delete consumer._keyFrameInterval;
          }

          if (!consumer.closed) {
            await consumer.close();
          }
        } catch (error) {
          console.warn(`   Warning: Error closing consumer:`, error.message);
        }
      }

      // Close all transports
      const allTransports = [
        ...(streamInfo.videoTransports || []),
        ...(streamInfo.audioTransports || []),
      ];
      console.log(`   Closing ${allTransports.length} transports...`);
      for (const transportInfo of allTransports) {
        try {
          if (transportInfo.transport && !transportInfo.transport.closed) {
            await transportInfo.transport.close();
          }
        } catch (error) {
          console.warn(`   Warning: Error closing transport:`, error.message);
        }
      }

      // Clean up files
      console.log(`   Cleaning up HLS files...`);
      try {
        await fs.remove(streamInfo.streamDir);
      } catch (error) {
        console.warn(`   Warning: Error cleaning up files:`, error.message);
      }

      // Remove from active streams
      this.activeStreams.delete(roomName);
      console.log(`✅ Stopped HLS stream for room: ${roomName}`);
    } catch (error) {
      console.error(
        `❌ Error stopping HLS stream for room ${roomName}:`,
        error
      );
      // Force remove from active streams even if cleanup failed
      this.activeStreams.delete(roomName);
    }
  }

  getStreamInfo(roomName) {
    return this.activeStreams.get(roomName);
  }

  isStreamActive(roomName) {
    return this.activeStreams.has(roomName);
  }

  getAllActiveStreams() {
    const streams = [];
    for (const [roomName, streamInfo] of this.activeStreams) {
      streams.push({
        roomName,
        isActive: streamInfo.isActive,
        startTime: streamInfo.startTime,
        playlistUrl: `/api/hls/streams/${roomName}/playlist.m3u8`,
        producerCount: streamInfo.producerCount,
        videoCount: streamInfo.videoTransports?.length || 0,
        audioCount: streamInfo.audioTransports?.length || 0,
      });
    }
    return streams;
  }
}

module.exports = HLSManager;
