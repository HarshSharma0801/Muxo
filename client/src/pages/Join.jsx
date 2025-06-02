import { useEffect, useState, useRef } from "react";
import { Device } from "mediasoup-client";

import initializeMediaConsumer from "../mediasoup/consumers/media-consumer";
import initializeConsumerTransport from "../mediasoup/consumers/media-consumer-transport";
import { useStream } from "../context/stream-context";
import { useSocket } from "../context/socket-context";
import { useNavigate } from "react-router";

const Join = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [roomData, setRoomData] = useState({ name: "", room: "" });
  const [error, setError] = useState(null);

  const { setConsumers, setDevice, setAllUsers, setUserName } = useStream();
  const { socket, isConnected } = useSocket();
  const deviceRef = useRef(null);
  const router = useNavigate();

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const setupConsumerTransports = (consumeData) => {
    consumeData.activeAudioProducers.forEach(async (audioPid, i) => {
      const videoPid = consumeData.activeVideoProducers[i];
      const consumerTransportParams = await socket.emitWithAck(
        "request-transport",
        { type: "consumer", audioPid }
      );
      if (!deviceRef.current) {
        return false;
      }
      const consumerTransport = initializeConsumerTransport(
        consumerTransportParams,
        deviceRef.current,
        socket,
        audioPid
      );

      const [audioConsumer, videoConsumer] = await Promise.all([
        initializeMediaConsumer(
          consumerTransport,
          audioPid,
          deviceRef.current,
          socket,
          "audio",
          i
        ),
        initializeMediaConsumer(
          consumerTransport,
          videoPid,
          deviceRef.current,
          socket,
          "video",
          i
        ),
      ]);

      const combinedStream = new MediaStream([
        audioConsumer?.track,
        videoConsumer?.track,
      ]);

      setAllUsers((prev) => {
        return [
          {
            combinedStream,
            userName: consumeData.associatedUserNames[i],
            consumerTransport,
            audioConsumer,
            videoConsumer,
          },
          ...prev,
        ];
      });

      setConsumers((prev) => {
        return {
          ...prev,
          [audioPid]: {
            combinedStream,
            userName: consumeData.associatedUserNames[i],
            consumerTransport,
            audioConsumer,
            videoConsumer,
          },
        };
      });
    });
    return true;
  };

  const handleChange = (e) => {
    const { value, name } = e.target;
    setRoomData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (isStreamer = false) => {
    if (!socket || !isConnected) {
      console.error("Socket is not initialized or not connected");
      setError("Please wait for the connection to establish.");
      return;
    }

    if (!roomData.name.trim()) {
      setError("Please enter your name");
      return;
    }

    if (!roomData.room.trim()) {
      setError("Please enter a room name");
      return;
    }

    try {
      setUserName(roomData.name.trim());

      const joinRoomRes = await new Promise((resolve, reject) => {
        socket.emit("join", roomData, (response) => {
          if (response && response.routerRtpCapabilities) {
            resolve(response);
          } else {
            reject(new Error("Invalid server response"));
          }
        });
      });

      deviceRef.current = new Device();
      await deviceRef.current.load({
        routerRtpCapabilities: joinRoomRes.routerRtpCapabilities,
      });

      const joined = setupConsumerTransports(joinRoomRes);

      if (deviceRef.current) {
        setDevice(deviceRef.current);
      }

      if (joined) {
        if (isStreamer) {
          router("/stream");
        } else {
          router("/watch");
        }
      } else {
        throw new Error("Failed to join room");
      }
    } catch (err) {
      console.error("Join room error:", err);
      setError(`Failed to join room: ${err.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-purple-900 flex items-center justify-center overflow-hidden">
      <div className="text-center px-6 py-16">
        {error && <div className="text-red-500 mb-4">{error}</div>}
        <div
          className={`transform transition-all duration-1000 ${
            isVisible ? "translate-y-0 opacity-100" : "translate-y-20 opacity-0"
          }`}
        >
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6">
            Join Room
          </h1>

          <div className="flex flex-col py-10 sm:flex-row gap-4 justify-center">
            <input
              onChange={handleChange}
              name="name"
              value={roomData.name}
              type="text"
              placeholder="Enter Name"
              className="px-4 py-2 border text-white border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition transform hover:scale-105 duration-300"
            />
            <input
              onChange={handleChange}
              name="room"
              value={roomData.room}
              type="text"
              placeholder="Enter Room Name"
              className="px-4 py-2 border text-white border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition transform hover:scale-105 duration-300"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => handleSubmit(true)}
              disabled={!isConnected}
              className={`px-8 py-3 cursor-pointer font-semibold rounded-full transition transform hover:scale-105 duration-300 ${
                isConnected
                  ? "bg-blue-500 hover:bg-blue-600 text-white"
                  : "bg-gray-500 text-gray-300 cursor-not-allowed"
              }`}
            >
              Join as Streamer
            </button>
            <button
              onClick={() => handleSubmit(false)}
              disabled={!isConnected}
              className={`px-8 py-3 cursor-pointer font-semibold rounded-full transition transform hover:scale-105 duration-300 ${
                isConnected
                  ? "bg-blue-500 hover:bg-blue-600 text-white"
                  : "bg-gray-500 text-gray-300 cursor-not-allowed"
              }`}
            >
              Join as Viewer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Join;
