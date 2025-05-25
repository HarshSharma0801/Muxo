import { useEffect, useState } from "react";
import { useNavigate } from "react-router";

const Home = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [hlsRoomName, setHlsRoomName] = useState("");
  const [availableStreams, setAvailableStreams] = useState([]);
  const [loadingStreams, setLoadingStreams] = useState(false);

  useEffect(() => {
    setIsVisible(true);
    fetchAvailableStreams();
  }, []);

  const router = useNavigate();

  const fetchAvailableStreams = async () => {
    try {
      setLoadingStreams(true);
      const response = await fetch("http://localhost:3030/api/hls/streams");
      if (response.ok) {
        const data = await response.json();
        setAvailableStreams(data.streams || []);
      }
    } catch (error) {
      console.error("Error fetching streams:", error);
    } finally {
      setLoadingStreams(false);
    }
  };

  const handleHLSWatch = (roomName = hlsRoomName) => {
    if (roomName.trim()) {
      router(`/hls-watch?room=${encodeURIComponent(roomName.trim())}`);
    }
  };

  const handleHLSSubmit = (e) => {
    e.preventDefault();
    handleHLSWatch();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-purple-900 flex items-center justify-center overflow-hidden">
      <div className="text-center px-6 py-16 max-w-4xl mx-auto">
        <div
          className={`transform transition-all duration-1000 ${
            isVisible ? "translate-y-0 opacity-100" : "translate-y-20 opacity-0"
          }`}
        >
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6">
            Muxo
          </h1>

          <p className="text-xl md:text-2xl text-gray-200 max-w-2xl mx-auto mb-10">
            Connect with anyone, anywhere with our high-quality video
            conferencing platform
          </p>

          {/* Main Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <button
              onClick={() => {
                router("/join");
              }}
              className="px-8 py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-full transition transform hover:scale-105 duration-300"
            >
              Join Room (WebRTC)
            </button>
          </div>

          {/* HLS Watch Section */}
          <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-2xl p-8 mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">
              Watch Live Streams (HLS)
            </h2>
            <p className="text-gray-200 mb-6">
              Watch live streams without joining rooms - just like YouTube Live!
            </p>

            {/* HLS Room Input */}
            <form onSubmit={handleHLSSubmit} className="mb-6">
              <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
                <input
                  type="text"
                  value={hlsRoomName}
                  onChange={(e) => setHlsRoomName(e.target.value)}
                  placeholder="Enter room name to watch"
                  className="flex-1 px-4 py-3 rounded-lg bg-white bg-opacity-20 text-white placeholder-gray-300 border border-white border-opacity-30 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <button
                  type="submit"
                  disabled={!hlsRoomName.trim()}
                  className="px-6 py-3 bg-green-500 hover:bg-green-600 disabled:bg-gray-500 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition transform hover:scale-105 duration-300"
                >
                  Watch Stream
                </button>
              </div>
            </form>

            {/* Available Streams */}
            <div>
              <div className="flex items-center justify-center gap-2 mb-4">
                <h3 className="text-lg font-semibold text-white">
                  Available Live Streams
                </h3>
                <button
                  onClick={fetchAvailableStreams}
                  disabled={loadingStreams}
                  className="p-1 text-gray-300 hover:text-white transition-colors"
                  title="Refresh streams"
                >
                  <svg
                    className={`w-4 h-4 ${
                      loadingStreams ? "animate-spin" : ""
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                </button>
              </div>

              {loadingStreams ? (
                <div className="text-gray-300">Loading streams...</div>
              ) : availableStreams.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {availableStreams.map((streamName) => (
                    <button
                      key={streamName}
                      onClick={() => handleHLSWatch(streamName)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition transform hover:scale-105 duration-200 flex items-center justify-center gap-2"
                    >
                      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                      {streamName}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-gray-300">
                  No live streams available at the moment
                </div>
              )}
            </div>
          </div>

          {/* Feature Comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
            <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-xl p-6">
              <h3 className="text-xl font-bold text-white mb-3">WebRTC Mode</h3>
              <ul className="text-gray-200 space-y-2">
                <li>• Interactive participation</li>
                <li>• Real-time communication</li>
                <li>• Low latency</li>
                <li>• Requires room joining</li>
              </ul>
            </div>
            <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-xl p-6">
              <h3 className="text-xl font-bold text-white mb-3">HLS Mode</h3>
              <ul className="text-gray-200 space-y-2">
                <li>• Watch-only experience</li>
                <li>• No room joining required</li>
                <li>• YouTube-like streaming</li>
                <li>• Scalable for many viewers</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
