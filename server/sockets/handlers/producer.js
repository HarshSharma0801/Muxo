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

    // Start HLS stream when first video producer joins
    if (kind === "video" && hlsManager && participant.room) {
      const hasVideoProducers = participant.room.members.some(
        (member) =>
          member.producer.video && member.producer.video.id !== producer.id
      );

      if (!hasVideoProducers) {
        // This is the first video producer, start HLS stream
        try {
          await hlsManager.startHLSStream(
            participant.room.roomName,
            participant.room
          );
          console.log(
            `Started HLS stream for room: ${participant.room.roomName}`
          );
        } catch (error) {
          console.error(
            `Failed to start HLS stream for room ${participant.room.roomName}:`,
            error
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
