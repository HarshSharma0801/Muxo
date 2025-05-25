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
      console.log(`HLS stream already active for room: ${roomName}`);
      return;
    }

    const streamDir = path.join(this.hlsDir, roomName);
    await fs.ensureDir(streamDir);

    // Get active producers in the room
    const producers = this.getActiveProducers(room);
    if (producers.length === 0) {
      console.log(`No active producers in room: ${roomName}`);
      return;
    }

    const streamInfo = {
      roomName,
      streamDir,
      playlistPath: path.join(streamDir, "playlist.m3u8"),
      isActive: true,
      startTime: Date.now(),
      plainTransports: [],
      consumers: [],
    };

    this.activeStreams.set(roomName, streamInfo);

    try {
      // Create plain transports and consumers for each producer
      await this.setupPlainTransports(streamInfo, room, producers);

      // Start the FFmpeg process with real RTP streams
      await this.startFFmpegProcess(streamInfo);

      console.log(`Started HLS stream for room: ${roomName}`);
    } catch (error) {
      console.error(`Failed to start HLS stream for room ${roomName}:`, error);
      await this.stopHLSStream(roomName);
      throw error;
    }
  }

  async setupPlainTransports(streamInfo, room, producers) {
    const { roomName } = streamInfo;

    for (const producerInfo of producers) {
      const { videoProducer, audioProducer } = producerInfo;

      // Setup video transport if video producer exists
      if (videoProducer) {
        const videoTransportInfo = await this.createPlainTransportForProducer(
          room.router,
          videoProducer,
          "video"
        );
        streamInfo.plainTransports.push(videoTransportInfo);
        streamInfo.consumers.push(videoTransportInfo.consumer);
      }

      // Setup audio transport if audio producer exists
      if (audioProducer) {
        const audioTransportInfo = await this.createPlainTransportForProducer(
          room.router,
          audioProducer,
          "audio"
        );
        streamInfo.plainTransports.push(audioTransportInfo);
        streamInfo.consumers.push(audioTransportInfo.consumer);
      }
    }

    console.log(
      `Created ${streamInfo.plainTransports.length} plain transports for room: ${roomName}`
    );
  }

  async createPlainTransportForProducer(router, producer, kind) {
    // Create plain transport for RTP out with a specific port range
    const plainTransport = await router.createPlainTransport({
      listenIp: {
        ip: "127.0.0.1",
        announcedIp: null,
      },
      rtcpMux: true,
      comedia: false, // We'll specify the connection details
    });

    // Get router capabilities and filter for the specific codec
    const routerCodecs = router.rtpCapabilities.codecs.filter(
      (codec) => codec.kind === kind
    );

    // Create RTP capabilities for the consumer
    const rtpCapabilities = {
      codecs: routerCodecs,
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

    // Get the local port assigned by MediaSoup
    const localPort = plainTransport.tuple.localPort;

    // Connect the transport to send RTP to a different port for FFmpeg
    const ffmpegPort = localPort + 1000; // Use a different port range for FFmpeg

    await plainTransport.connect({
      ip: "127.0.0.1",
      port: ffmpegPort,
    });

    console.log(
      `Created ${kind} plain transport: MediaSoup port ${localPort} → FFmpeg port ${ffmpegPort} for producer ${producer.id}`
    );

    return {
      transport: plainTransport,
      consumer,
      kind,
      localPort,
      ffmpegPort,
      rtpParameters: consumer.rtpParameters,
      producerId: producer.id,
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

  async startFFmpegProcess(streamInfo) {
    const { roomName, streamDir, plainTransports } = streamInfo;
    const outputPath = path.join(streamDir, "playlist.m3u8");

    // Find video and audio transports
    const videoTransport = plainTransports.find((t) => t.kind === "video");
    const audioTransport = plainTransports.find((t) => t.kind === "audio");

    if (!videoTransport && !audioTransport) {
      throw new Error("No video or audio transports available for FFmpeg");
    }

    // Generate SDP file for FFmpeg
    const sdpContent = this.generateSDP(videoTransport, audioTransport);
    const sdpPath = path.join(streamDir, "input.sdp");

    await fs.writeFile(sdpPath, sdpContent);
    console.log(`Generated SDP file for room ${roomName}:\n${sdpContent}`);

    // Build FFmpeg arguments for SDP input
    const ffmpegArgs = [
      "-loglevel",
      "info",
      "-y",
      "-protocol_whitelist",
      "file,udp,rtp",
      "-f",
      "sdp",
      "-i",
      sdpPath,
    ];

    // Add output parameters
    if (videoTransport) {
      ffmpegArgs.push("-map", "0:v:0");
      ffmpegArgs.push(
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-tune",
        "zerolatency"
      );
    }

    if (audioTransport) {
      ffmpegArgs.push("-map", "0:a:0");
      ffmpegArgs.push("-c:a", "aac", "-b:a", "128k");
    }

    // HLS output settings
    ffmpegArgs.push(
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
      outputPath
    );

    console.log(
      `Starting FFmpeg for room ${roomName} with args:`,
      ffmpegArgs.join(" ")
    );

    const ffmpegProcess = spawn("ffmpeg", ffmpegArgs);

    ffmpegProcess.stdout.on("data", (data) => {
      console.log(`FFmpeg stdout for ${roomName}: ${data}`);
    });

    ffmpegProcess.stderr.on("data", (data) => {
      console.log(`FFmpeg stderr for ${roomName}: ${data}`);
    });

    ffmpegProcess.on("close", (code) => {
      console.log(`FFmpeg process for ${roomName} exited with code ${code}`);
      this.stopHLSStream(roomName);
    });

    ffmpegProcess.on("error", (error) => {
      console.error(`FFmpeg process error for ${roomName}:`, error.message);
      this.stopHLSStream(roomName);
    });

    streamInfo.ffmpegProcess = ffmpegProcess;

    // Resume consumers after a short delay to ensure FFmpeg is ready
    setTimeout(async () => {
      try {
        for (const consumer of streamInfo.consumers) {
          await consumer.resume();
          if (consumer.kind === "video") {
            await consumer.requestKeyFrame();
          }
        }
        console.log(
          `Resumed ${streamInfo.consumers.length} consumers for room: ${roomName}`
        );
      } catch (error) {
        console.error(`Error resuming consumers for room ${roomName}:`, error);
      }
    }, 2000);
  }

  generateSDP(videoTransport, audioTransport) {
    let sdp = `v=0\r\n`;
    sdp += `o=- 0 0 IN IP4 127.0.0.1\r\n`;
    sdp += `s=MediaSoup HLS Stream\r\n`;
    sdp += `c=IN IP4 127.0.0.1\r\n`;
    sdp += `t=0 0\r\n`;

    if (videoTransport) {
      const videoCodec = videoTransport.rtpParameters.codecs[0];
      const videoPort = videoTransport.ffmpegPort;

      sdp += `m=video ${videoPort} RTP/AVP ${videoCodec.payloadType}\r\n`;
      sdp += `a=rtpmap:${videoCodec.payloadType} ${videoCodec.mimeType.replace(
        "video/",
        ""
      )}/${videoCodec.clockRate}\r\n`;

      if (videoCodec.parameters) {
        const params = Object.entries(videoCodec.parameters)
          .map(([key, value]) => `${key}=${value}`)
          .join(";");
        if (params) {
          sdp += `a=fmtp:${videoCodec.payloadType} ${params}\r\n`;
        }
      }

      sdp += `a=sendonly\r\n`;
    }

    if (audioTransport) {
      const audioCodec = audioTransport.rtpParameters.codecs[0];
      const audioPort = audioTransport.ffmpegPort;

      sdp += `m=audio ${audioPort} RTP/AVP ${audioCodec.payloadType}\r\n`;
      sdp += `a=rtpmap:${audioCodec.payloadType} ${audioCodec.mimeType.replace(
        "audio/",
        ""
      )}/${audioCodec.clockRate}`;

      if (audioCodec.channels && audioCodec.channels > 1) {
        sdp += `/${audioCodec.channels}`;
      }

      sdp += `\r\n`;

      if (audioCodec.parameters) {
        const params = Object.entries(audioCodec.parameters)
          .map(([key, value]) => `${key}=${value}`)
          .join(";");
        if (params) {
          sdp += `a=fmtp:${audioCodec.payloadType} ${params}\r\n`;
        }
      }

      sdp += `a=sendonly\r\n`;
    }

    return sdp;
  }

  async stopHLSStream(roomName) {
    const streamInfo = this.activeStreams.get(roomName);
    if (!streamInfo) {
      return;
    }

    // Stop FFmpeg process
    if (streamInfo.ffmpegProcess) {
      try {
        streamInfo.ffmpegProcess.kill("SIGTERM");
      } catch (error) {
        console.error(
          `Error killing FFmpeg process for ${roomName}:`,
          error.message
        );
      }
    }

    // Close all consumers
    if (streamInfo.consumers) {
      for (const consumer of streamInfo.consumers) {
        try {
          consumer.close();
        } catch (error) {
          console.error(
            `Error closing consumer for ${roomName}:`,
            error.message
          );
        }
      }
    }

    // Close all plain transports
    if (streamInfo.plainTransports) {
      for (const transportInfo of streamInfo.plainTransports) {
        try {
          transportInfo.transport.close();
        } catch (error) {
          console.error(
            `Error closing plain transport for ${roomName}:`,
            error.message
          );
        }
      }
    }

    streamInfo.isActive = false;
    this.activeStreams.delete(roomName);

    // Clean up HLS files
    try {
      await fs.remove(streamInfo.streamDir);
    } catch (error) {
      console.error(`Error cleaning up HLS files for room ${roomName}:`, error);
    }

    console.log(`Stopped HLS stream for room: ${roomName}`);
  }

  getStreamInfo(roomName) {
    return this.activeStreams.get(roomName);
  }

  isStreamActive(roomName) {
    const streamInfo = this.activeStreams.get(roomName);
    return streamInfo && streamInfo.isActive;
  }

  getAllActiveStreams() {
    return Array.from(this.activeStreams.keys());
  }

  async updateStream(roomName, room) {
    // Called when producers change in a room
    if (this.isStreamActive(roomName)) {
      const producers = this.getActiveProducers(room);
      if (producers.length === 0) {
        // No more producers, stop the stream
        await this.stopHLSStream(roomName);
      } else {
        // For now, we restart the stream when producers change
        // In a more advanced implementation, you could dynamically add/remove consumers
        console.log(
          `Producers changed in room ${roomName}, restarting HLS stream...`
        );
        await this.stopHLSStream(roomName);
        setTimeout(() => {
          this.startHLSStream(roomName, room);
        }, 1000);
      }
    }
  }

  // Method to handle multiple producers (mixing)
  async createMixedStream(roomName, room) {
    // This is a placeholder for future implementation of mixing multiple video/audio streams
    // For now, we handle the first producer of each type
    console.log(
      `Mixed stream creation not yet implemented for room: ${roomName}`
    );
  }
}

module.exports = HLSManager;
