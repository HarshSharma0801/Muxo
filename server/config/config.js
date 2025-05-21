const config = {
  workerSettings: {
      rtcMinPort: 40000,
      rtcMaxPort: 41000,
      logLevel: 'warn',
      logTags: [
          'info',
          'ice',
          'dtls',
          'rtp',
          'srtp',
          'rtcp'            
      ]
  },
  routerMediaCodecs: [
      {
        kind: "audio",
        mimeType: "audio/opus",
        clockRate: 48000,
        channels: 2
      },
      {
        kind: "video",
        mimeType: "video/VP8", // Prioritize VP8 for t2.micro
        clockRate: 90000,
        parameters: {}
      },
      {
        kind: "video",
        mimeType: "video/H264",
        clockRate: 90000,
        parameters: {
          "packetization-mode": 1,
          "profile-level-id": "42e01f",
          "level-asymmetry-allowed": 1
        }
      }
  ],
  webRtcTransport: {
    listenIps: [
      {
        ip: '0.0.0.0', // Listen on all interfaces
        announcedIp: '13.127.148.79' // EC2 public IP
      }
    ],
    maxIncomingBitrate: 1500000, // Reduce to 1.5 Mbps for t2.micro
    initialAvailableOutgoingBitrate: 1500000 // Reduce to 1.5 Mbps
  },
};

module.exports = config;