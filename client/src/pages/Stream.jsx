import { useEffect, useState, useRef } from "react";
import { useStream } from "../context/stream-context";
import initializeProducerTransport from "../mediasoup/producers/media-producer-transport";
import initializeMediaProducers from "../mediasoup/producers/media-producer";
import initializeMediaConsumer from "../mediasoup/consumers/media-consumer";
import initializeConsumerTransport from "../mediasoup/consumers/media-consumer-transport";
import { useSocket } from "../context/socket-context";
import { useNavigate } from "react-router";

const Stream = () => {
  const { socket } = useSocket();

  const router = useNavigate();

  const { AllUsers, device, setConsumers, setAllUsers } = useStream();
  const [isVisible, setIsVisible] = useState(true);

  const localStreamVid = useRef();
  let localStream = null;
  let producerTransport = null;

  const [yourFeed, setYourFeed] = useState(false);

  const setupConsumerTransports = (consumeData) => {
    if (!device) {
      console.error("Device is not initialized");
      return false;
    }

    // Filter out any undefined/null PIDs
    const validIndices = consumeData.activeAudioProducers
      .map((pid, i) => (pid ? i : null))
      .filter((i) => i !== null);

    return Promise.all(
      validIndices.map(async (i) => {
        const audioPid = consumeData.activeAudioProducers[i];
        const videoPid = consumeData.activeVideoProducers[i];

        if (!audioPid || !videoPid) return;

        try {
          const consumerTransportParams = await socket.emitWithAck(
            "requestTransport",
            { type: "consumer", audioPid }
          );

          const consumerTransport = initializeConsumerTransport(
            consumerTransportParams,
            device,
            socket,
            audioPid
          );

          const [audioConsumer, videoConsumer] = await Promise.all([
            initializeMediaConsumer(
              consumerTransport,
              audioPid,
              device,
              socket,
              "audio",
              i
            ),
            initializeMediaConsumer(
              consumerTransport,
              videoPid,
              device,
              socket,
              "video",
              i
            ),
          ]);

          const combinedStream = new MediaStream([
            audioConsumer?.track,
            videoConsumer?.track,
          ]);

          setAllUsers((prev) => [
            {
              combinedStream,
              userName: consumeData.associatedUserNames[i],
              consumerTransport,
              audioConsumer,
              videoConsumer,
            },
            ...prev,
          ]);

          setConsumers((prev) => ({
            ...prev,
            [audioPid]: {
              combinedStream,
              userName: consumeData.associatedUserNames[i],
              consumerTransport,
              audioConsumer,
              videoConsumer,
            },
          }));
        } catch (error) {
          console.error("Error setting up consumer:", error);
        }
      })
    ).then(() => true);
  };

  const sendFeed = async () => {
    producerTransport = await initializeProducerTransport(socket, device);
    const producers = await initializeMediaProducers(
      localStream,
      producerTransport
    );
    console.log(producers);
  };

  const enableFeed = async () => {
    setYourFeed(true);
    setIsVisible(false);
    try {
      localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: {
          width: { min: 640, ideal: 1280, max: 1920 },
          height: { min: 360, ideal: 720, max: 1080 },
          frameRate: { min: 16, ideal: 30, max: 30 },
        },
      });

      if (localStreamVid.current) {
        localStreamVid.current.srcObject = localStream;
      } else {
        console.error("Video element reference is null.");
      }

      sendFeed();
    } catch (error) {
      console.error("Error accessing user media:", error);
    }
  };

  useEffect(() => {
    socket.on("newProducersToConsume", (consumeData) => {
      console.log("newProducersToConsume....!!");
      console.log(consumeData);
      const consumed = setupConsumerTransports(consumeData);
      if (consumed) {
        console.log("consumed");
      }
    });

    socket.on("updateActiveSpeakers", (newListOfActives) => {
      console.log("updateActiveSpeakers", newListOfActives);
    });

    return () => {
      socket.off("newProducersToConsume");
      socket.off("updateActiveSpeakers");
    };
  }, []);

  useEffect(() => {
    console.log(AllUsers, "AllUsers hereee");
  }, [AllUsers]);

  useEffect(() => {
    const handleProducerClosed = ({ audioPid, videoPid }) => {
      setAllUsers((prev) =>
        prev.filter(
          (user) =>
            user.audioConsumer?.producerId !== audioPid &&
            user.videoConsumer?.producerId !== videoPid
        )
      );

      setConsumers((prev) => {
        const newConsumers = { ...prev };
        delete newConsumers[audioPid];
        return newConsumers;
      });
    };

    socket.on("producerClosed", handleProducerClosed);

    return () => {
      socket.off("producerClosed", handleProducerClosed);
    };
  }, []);

  const hangUp = async () => {
    try {
      if (localStreamVid.current?.srcObject) {
        localStreamVid.current.srcObject
          .getTracks()
          .forEach((track) => track.stop());
        localStreamVid.current.srcObject = null;
      }

      setYourFeed(false);
      setIsVisible(true);

      // Notify server to clean up
      await socket.emitWithAck("hangUp");

      // Clean up local state
      setAllUsers([]);
      setConsumers({});
      router("/");
    } catch (error) {
      console.error("Error during hangup:", error);
    }
  };

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-blue-900 to-purple-900 p-4 md:p-8">
        {/* Header with participant count */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-xl font-bold text-white">Video Conference</h1>
          {AllUsers.length > 0 && (
            <div className="bg-blue-800 text-white px-3 py-1 rounded-full text-sm">
              {AllUsers.length + (yourFeed ? 1 : 0)} participants
            </div>
          )}
        </div>
        {/* Local video (self view) */}

        {yourFeed && (
          <div className="absolute bottom-4 right-4 z-10">
            <div className="relative w-70 h-40">
              <video
                ref={localStreamVid}
                className="w-full h-full rounded-lg shadow-lg border-2 border-white"
                muted
                autoPlay
              ></video>
              <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 rounded-b-lg">
                You
              </div>
              <button
                onClick={hangUp}
                className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-2 shadow-lg"
                title="Leave call"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z"
                  />
                </svg>
              </button>
            </div>
          </div>
        )}
        {/* Remote videos grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {AllUsers && AllUsers.length > 0 ? (
            AllUsers.map((data, index) => (
              <div
                key={`${data.combinedStream}-${index}`}
                className="relative bg-gray-800 rounded-xl overflow-hidden shadow-lg"
              >
                <video
                  ref={(videoElement) => {
                    if (videoElement && data.combinedStream) {
                      videoElement.srcObject = data.combinedStream;
                    }
                  }}
                  className="w-full h-full object-cover"
                  autoPlay
                ></video>
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-3">
                  <div className="text-white font-medium">
                    {data.userName || `Participant ${index + 1}`}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full flex flex-col items-center justify-center h-64 text-white">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-12 w-12 mb-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              <p className="text-lg">Waiting for participants to join...</p>
            </div>
          )}
        </div>
      </div>

      {/* Enable media modal */}
      <div
        className={`${
          isVisible ? "fixed" : "hidden"
        } inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 backdrop-blur-sm`}
      >
        <div className="bg-gradient-to-br from-blue-800 to-purple-800 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6 text-blue-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">
              Join the Conference
            </h3>
            <p className="text-blue-100 mb-6">
              Enable your camera and microphone to join the meeting
            </p>
            <div className="flex justify-center gap-4">
              <button
                onClick={enableFeed}
                className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white font-medium rounded-lg transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-opacity-50"
              >
                Join Now
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Stream;
