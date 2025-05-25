#!/bin/bash

echo "Starting Muxo Development Environment..."

# Check if FFmpeg is installed
if ! command -v ffmpeg &> /dev/null; then
    echo "Warning: FFmpeg is not installed. HLS streaming will not work."
    echo "Please install FFmpeg: https://ffmpeg.org/download.html"
fi

# Function to cleanup background processes
cleanup() {
    echo "Stopping development servers..."
    kill $SERVER_PID $CLIENT_PID 2>/dev/null
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Start server in background
echo "Starting server..."
cd server && npm start &
SERVER_PID=$!

# Wait a moment for server to start
sleep 3

# Start client in background
echo "Starting client..."
cd ../client && npm run dev &
CLIENT_PID=$!

echo "Development environment started!"
echo "Server: http://localhost:3030"
echo "Client: http://localhost:5173"
echo "HLS API: http://localhost:3030/api/hls/streams"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for background processes
wait 