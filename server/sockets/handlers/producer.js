const updateSpeakers = require("../../media-helpers/updateSpeakers");

const handleStartProducing = async (
  participant,
  { kind, rtpParameters },
  socket,
  hlsManager
) => {
  try {
    const producer = await participant.upstreamTransport.produce({
      kind,
      rtpParameters,
    });

    participant.addProducer(kind, producer);
    if (kind === "audio") {
      participant.room.activeSpeakerList.push(producer.id);
    }

    producer.on("transportclose", () => {
      console.log("Producer transport closed");
      producer.close();
    });

    producer.on("close", () => {
      console.log("Producer closed");
      participant.removeProducer(kind);

      // Notify all participants in the room about producer closure
      socket.to(participant.room.roomName).emit("producerClosed", {
        audioPid: kind === "audio" ? producer.id : null,
        videoPid: kind === "video" ? producer.id : null,
      });

      // Update HLS stream when producer closes
      if (hlsManager && participant.room) {
        hlsManager.updateStream(participant.room.roomName, participant.room);
      }
    });

    // 🎬 NEW: Handle HLS stream for ANY producer (video or audio)
    if (hlsManager && participant.room) {
      const roomName = participant.room.roomName;

      if (kind === "video") {
        // For video producers, always update the stream
        console.log(
          `🎥 Video producer joined room ${roomName}, updating HLS stream...`
        );

        try {
          if (hlsManager.isStreamActive(roomName)) {
            // Stream exists, update it to include new producer
            await hlsManager.updateStream(roomName, participant.room);
          } else {
            // No stream exists, start new one
            await hlsManager.startHLSStream(roomName, participant.room);
            console.log(`✅ Started HLS stream for room: ${roomName}`);
          }
        } catch (error) {
          console.error(
            `❌ Failed to handle HLS stream for room ${roomName}:`,
            error
          );
        }
      } else if (kind === "audio") {
        // For audio producers, only update if video stream already exists
        if (hlsManager.isStreamActive(roomName)) {
          console.log(
            `🎵 Audio producer joined room ${roomName}, updating HLS stream...`
          );
          try {
            await hlsManager.updateStream(roomName, participant.room);
          } catch (error) {
            console.error(
              `❌ Failed to update HLS stream for audio in room ${roomName}:`,
              error
            );
          }
        } else {
          console.log(
            `🎵 Audio producer joined room ${roomName}, but no video stream exists yet`
          );
        }
      }
    }

    const newTransportsByPeer = updateSpeakers(participant.room, socket.io);

    for (const [socketId, activeAudioProducers] of Object.entries(
      newTransportsByPeer
    )) {
      const activeVideoProducers = activeAudioProducers.map((aPid) => {
        const producerParticipant = participant.room.members.find(
          (c) => c?.producer?.audio?.id === aPid
        );
        return producerParticipant?.producer?.video?.id;
      });

      const associatedUserNames = activeAudioProducers.map((aPid) => {
        const producerParticipant = participant.room.members.find(
          (c) => c?.producer?.audio?.id === aPid
        );
        return producerParticipant?.userName;
      });

      socket.io.to(socketId).emit("newProducersToConsume", {
        routerRtpCapabilities: participant.room.router.rtpCapabilities,
        activeAudioProducers,
        activeVideoProducers,
        associatedUserNames,
        activeSpeakerList: participant.room.activeSpeakerList.slice(0, 5),
      });
    }

    return { id: producer.id };
  } catch (error) {
    console.error(error);
    return "error";
  }
};

module.exports = {
  handleStartProducing,
};
