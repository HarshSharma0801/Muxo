import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Hls from "hls.js";

const HLSWatch = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const roomName = searchParams.get("room");

  const videoRef = useRef(null);
  const hlsRef = useRef(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [streamInfo, setStreamInfo] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (!roomName) {
      setError("Room name is required");
      setIsLoading(false);
      return;
    }

    initializeHLSPlayer();

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
    };
  }, [roomName]);

  const initializeHLSPlayer = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Check if stream exists
      const response = await fetch(
        `http://localhost:3030/api/hls/streams/${roomName}/info`
      );

      if (!response.ok) {
        if (response.status === 404) {
          setError(
            "Stream not found. The room may not have any active streamers."
          );
        } else {
          setError("Failed to fetch stream information");
        }
        setIsLoading(false);
        return;
      }

      const info = await response.json();
      setStreamInfo(info);

      // Initialize HLS player
      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 90,
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
          liveSyncDurationCount: 3,
          liveMaxLatencyDurationCount: 5,
        });

        hlsRef.current = hls;

        hls.loadSource(info.playlistUrl);
        hls.attachMedia(videoRef.current);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          console.log("HLS manifest parsed");
          setIsLoading(false);
          // Auto-play the stream
          videoRef.current.play().catch(console.error);
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          console.error("HLS error:", data);
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                setError("Network error occurred while loading the stream");
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                setError("Media error occurred while playing the stream");
                break;
              default:
                setError("An error occurred while playing the stream");
                break;
            }
          }
        });
      } else if (
        videoRef.current.canPlayType("application/vnd.apple.mpegurl")
      ) {
        // Native HLS support (Safari)
        videoRef.current.src = info.playlistUrl;
        videoRef.current.addEventListener("loadedmetadata", () => {
          setIsLoading(false);
          videoRef.current.play().catch(console.error);
        });
      } else {
        setError("HLS is not supported in this browser");
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Error initializing HLS player:", error);
      setError("Failed to initialize video player");
      setIsLoading(false);
    }
  };

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(console.error);
      }
    }
  };

  const handleVideoPlay = () => setIsPlaying(true);
  const handleVideoPause = () => setIsPlaying(false);

  const goBack = () => {
    navigate("/");
  };

  const refreshStream = () => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
    }
    initializeHLSPlayer();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-purple-900 p-4 md:p-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={goBack}
            className="bg-gray-700 hover:bg-gray-600 text-white rounded-md p-2 shadow-lg"
            title="Go back"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
          </button>
          <h1 className="text-xl font-bold text-white">
            Muxo - Live Stream: {roomName}
          </h1>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={refreshStream}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-md p-2 shadow-lg"
            title="Refresh stream"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>

          {streamInfo && (
            <div className="bg-green-600 text-white px-3 py-1 rounded-full text-sm flex items-center">
              <div className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse"></div>
              LIVE
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto">
        {isLoading && (
          <div className="flex flex-col items-center justify-center h-96 text-white">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
            <p className="text-lg">Loading stream...</p>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center h-96 text-white">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-16 w-16 mb-4 text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-lg mb-4">{error}</p>
            <button
              onClick={refreshStream}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
            >
              Try Again
            </button>
          </div>
        )}

        {!isLoading && !error && (
          <div className="relative bg-black rounded-xl overflow-hidden shadow-2xl">
            <video
              ref={videoRef}
              className="w-full h-auto max-h-[70vh] object-contain"
              controls
              muted
              playsInline
              onPlay={handleVideoPlay}
              onPause={handleVideoPause}
              poster="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTI4MCIgaGVpZ2h0PSI3MjAiIHZpZXdCb3g9IjAgMCAxMjgwIDcyMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjEyODAiIGhlaWdodD0iNzIwIiBmaWxsPSIjMTExODI3Ii8+CjxwYXRoIGQ9Ik02NDAgMzYwTDU4MCAzMDBWNDIwTDY0MCAzNjBaIiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4K"
            />

            {/* Stream Info Overlay */}
            {streamInfo && (
              <div className="absolute top-4 left-4 bg-black bg-opacity-50 text-white px-3 py-2 rounded-md">
                <p className="text-sm">
                  Started: {new Date(streamInfo.startTime).toLocaleTimeString()}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Stream Details */}
        {streamInfo && !error && (
          <div className="mt-6 bg-gray-800 rounded-xl p-6 text-white">
            <h2 className="text-xl font-bold mb-4">Stream Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-gray-300">Room Name</p>
                <p className="font-semibold">{streamInfo.roomName}</p>
              </div>
              <div>
                <p className="text-gray-300">Status</p>
                <p className="font-semibold text-green-400">
                  {streamInfo.isActive ? "Live" : "Offline"}
                </p>
              </div>
              <div>
                <p className="text-gray-300">Stream Started</p>
                <p className="font-semibold">
                  {new Date(streamInfo.startTime).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-gray-300">Stream Type</p>
                <p className="font-semibold">HLS Live Stream</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HLSWatch;
