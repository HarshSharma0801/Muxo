# Muxo - SFU Video Conferencing with HLS Streaming

A modern video conferencing application built with MediaSoup SFU (Selective Forwarding Unit) and HLS (HTTP Live Streaming) support. This application provides two distinct modes for video streaming:

1. **WebRTC Mode**: Interactive real-time communication with low latency
2. **HLS Mode**: YouTube-like live streaming for watch-only experiences

## Features

### WebRTC Mode (Original SFU)

- Real-time video conferencing
- Low latency communication
- Interactive participation (audio/video)
- Room-based architecture
- Dominant speaker detection
- Multiple participants support

### HLS Mode (New Feature)

- YouTube-like live streaming
- No room joining required
- Scalable for many viewers
- HTTP-based streaming
- Watch-only experience
- Automatic stream discovery

## Architecture

### Server Side

- **Express.js** server with Socket.IO for real-time communication
- **MediaSoup** for SFU functionality and WebRTC handling
- **FFmpeg** for transcoding WebRTC streams to HLS format
- **HLS Manager** for stream lifecycle management
- RESTful API for HLS stream management

### Client Side

- **React** application with modern UI
- **MediaSoup Client** for WebRTC functionality
- **HLS.js** for HLS video playback
- Responsive design with Tailwind CSS

## Installation

### Prerequisites

- Node.js (v16 or higher)
- FFmpeg installed on your system
- Modern web browser with WebRTC support

### Server Setup

```bash
cd server
npm install
npm start
```

### Client Setup

```bash
cd client
npm install
npm run dev
```

## Usage

### Starting the Application

1. Start the server: `cd server && npm start`
2. Start the client: `cd client && npm run dev`
3. Open your browser to `http://localhost:5173`

### WebRTC Mode

1. Click "Join Room (WebRTC)" on the home page
2. Enter your name and room name
3. Choose to either "Stream" or "Watch"
4. Grant camera/microphone permissions if streaming

### HLS Mode

1. On the home page, enter a room name in the "Watch Live Streams" section
2. Click "Watch Stream" to start HLS playback
3. Or select from available live streams if any are active

## API Endpoints

### HLS API

- `GET /api/hls/streams` - List all active streams
- `GET /api/hls/streams/:roomName/info` - Get stream information
- `GET /api/hls/streams/:roomName/playlist.m3u8` - HLS playlist
- `GET /api/hls/streams/:roomName/:segment` - HLS video segments
- `POST /api/hls/streams/:roomName/start` - Start HLS stream (manual)
- `POST /api/hls/streams/:roomName/stop` - Stop HLS stream

## Configuration

### Server Configuration

Edit `server/config/config.js` to modify:

- MediaSoup worker settings
- WebRTC transport configuration
- Router media codecs
- Port ranges

### HLS Configuration

The HLS manager can be configured in `server/hls/hlsManager.js`:

- Segment duration
- Playlist size
- Video quality settings
- FFmpeg parameters

## File Structure

```
├── server/
│   ├── classes/
│   │   ├── Participant.js
│   │   └── Room.js
│   ├── config/
│   │   └── config.js
│   ├── hls/
│   │   └── hlsManager.js
│   ├── media-helpers/
│   │   ├── createWorkers.js
│   │   ├── dominantSpeaker.js
│   │   ├── getWorker.js
│   │   └── updateSpeakers.js
│   ├── routes/
│   │   └── hlsRoutes.js
│   ├── sockets/
│   │   ├── handlers/
│   │   │   ├── consumer.js
│   │   │   ├── disconnect.js
│   │   │   ├── joinRoom.js
│   │   │   ├── producer.js
│   │   │   └── transport.js
│   │   └── index.js
│   ├── package.json
│   └── server.js
├── client/
│   ├── src/
│   │   ├── components/
│   │   ├── context/
│   │   │   ├── socket-context.jsx
│   │   │   └── stream-context.jsx
│   │   ├── mediasoup/
│   │   │   ├── consumers/
│   │   │   └── producers/
│   │   ├── pages/
│   │   │   ├── Home.jsx
│   │   │   ├── Join.jsx
│   │   │   ├── Stream.jsx
│   │   │   ├── Watch.jsx
│   │   │   └── HLSWatch.jsx
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
└── README.md
```

## How It Works

### WebRTC Flow

1. User joins a room via Socket.IO
2. MediaSoup creates router and transports
3. Producers send audio/video streams
4. Consumers receive streams from other participants
5. Real-time communication with low latency

### HLS Flow

1. When first producer joins a room, HLS stream starts automatically
2. FFmpeg transcodes WebRTC stream to HLS format
3. Video segments and playlist are generated
4. Viewers access stream via HTTP without joining room
5. HLS.js handles playback in the browser

### Stream Lifecycle

- **Start**: Triggered when first video producer joins a room
- **Update**: When producers join/leave, stream is updated
- **Stop**: When no more producers remain in room
- **Cleanup**: Temporary files are removed when stream ends

## Browser Support

### WebRTC Mode

- Chrome 60+
- Firefox 60+
- Safari 12+
- Edge 79+

### HLS Mode

- All modern browsers (HLS.js provides compatibility)
- Native HLS support in Safari
- Fallback support for older browsers

## Troubleshooting

### Common Issues

1. **FFmpeg not found**

   - Install FFmpeg on your system
   - Ensure it's in your PATH

2. **WebRTC connection fails**

   - Check firewall settings
   - Verify STUN/TURN configuration
   - Ensure proper port ranges in config

3. **HLS stream not starting**

   - Check FFmpeg installation
   - Verify write permissions for HLS directory
   - Check server logs for errors

4. **Video not playing**
   - Ensure browser supports HLS
   - Check network connectivity
   - Verify stream is active

## Development

### Adding New Features

1. Server-side changes go in respective directories
2. Client-side components follow React patterns
3. Update API documentation for new endpoints
4. Add proper error handling and logging

### Testing

- Test both WebRTC and HLS modes
- Verify cross-browser compatibility
- Test with multiple concurrent users
- Monitor server performance

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For issues and questions:

1. Check the troubleshooting section
2. Review server logs
3. Test with different browsers
4. Create an issue with detailed information
