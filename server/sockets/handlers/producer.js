const updateSpeakers = require("../../media-helpers/updateSpeakers");

const handleStartProducing = async (
  participant,
  { kind, rtpParameters },
  socket
) => {
  try {
    const newProducer = await participant.upstreamTransport.produce({
      kind,
      rtpParameters,
    });

    participant.addProducer(kind, newProducer);
    if (kind === "audio") {
      participant.room.activeSpeakerList.push(newProducer.id);
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

    return newProducer.id;
  } catch (error) {
    console.error(error);
    return "error";
  }
};

module.exports = {
  handleStartProducing,
};
