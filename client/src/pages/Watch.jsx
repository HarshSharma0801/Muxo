import { useEffect, useState, useRef } from "react";
import { useStream } from "../context/stream-context";
import initializeMediaConsumer from "../mediasoup/consumers/media-consumer";
import initializeConsumerTransport from "../mediasoup/consumers/media-consumer-transport";
import { useSocket } from "../context/socket-context";
import { useNavigate } from "react-router";

const Watch = () => {
  const { socket } = useSocket();

  const router = useNavigate();

  const { AllUsers, device, setConsumers, setAllUsers } = useStream();

  const localStreamVid = useRef();

  const [yourFeed, setYourFeed] = useState(false);

  const setupConsumerTransports = (consumeData) => {
    if (!device) {
      console.error("Device is not initialized");
      return false;
    }

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
            "request-transport",
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

  useEffect(() => {
    socket.on("newProducersToConsume", (consumeData) => {
      const consumed = setupConsumerTransports(consumeData);
      if (consumed) {
        console.log("consumed");
      }
    });

    socket.on("updateActiveSpeakers", (newListOfActives) => {
      console.log("updateActiveSpeakers");
    });

    return () => {
      socket.off("newProducersToConsume");
      socket.off("updateActiveSpeakers");
    };
  }, []);

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

      await socket.emitWithAck("hangUp");

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
          <h1 className="text-xl font-bold text-white">Muxo</h1>
          <div className="flex items-center justify-center">
            <div>
              {AllUsers.length > 0 && (
                <div className="bg-blue-800 text-white px-3 py-1 rounded-full text-sm">
                  {AllUsers.length + (yourFeed ? 1 : 0)} participants
                </div>
              )}
            </div>
            <div className="flex justify-center items-center ml-4">
              <button
                onClick={hangUp}
                className="bg-red-500 hover:bg-red-600 text-white rounded-md p-2 shadow-lg"
                title="Leave call"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-8 w-8"
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
        </div>

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
              <p className="text-lg">Waiting for streamers to join...</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Watch;
