
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
        kind        : "audio",
        mimeType    : "audio/opus",
        clockRate   : 48000,
        channels    : 2
      },
      {
        kind       : "video",
        mimeType   : "video/H264",
        clockRate  : 90000,
        parameters :
        {
          "packetization-mode"      : 1,
          "profile-level-id"        : "42e01f",
          "level-asymmetry-allowed" : 1
        }
      },
      {
          kind       : "video",
          mimeType   : "video/VP8",
          clockRate  : 90000,
          parameters : {}
        }        
  ],
  webRtcTransport: {
    listenIps: [
      {
        ip: '127.0.0.1', 
        announcedIp: null
      }
    ],
   
    maxIncomingBitrate: 5000000, 
    initialAvailableOutgoingBitrate: 5000000 
  },
}

module.exports = config
