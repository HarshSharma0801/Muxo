const updateSpeakers = require("./updateSpeakers");

function dominantSpeaker(dominantSpeaker, room, io) {
  const producerIndex = room.activeSpeakerList.findIndex(
    (producerId) => producerId === dominantSpeaker.producer.id
  );
  if (producerIndex > -1) {
    const [producerId] = room.activeSpeakerList.splice(producerIndex, 1);
    room.activeSpeakerList.unshift(producerId);
  } else {
    room.activeSpeakerList.unshift(dominantSpeaker.producer.id);
  }

  const newTransportsByPeer = updateSpeakers(room, io);
  for (const [socketId, activeAudioProducers] of Object.entries(
    newTransportsByPeer
  )) {
    const activeVideoProducers = activeAudioProducers.map((audioPid) => {
      const producerParticipant = room.members.find(
        (c) => c?.producer?.audio?.id === audioPid
      );
      return producerParticipant?.producer?.video?.id;
    });
    const associatedUserNames = activeAudioProducers.map((audioPid) => {
      const producerParticipant = room.members.find(
        (c) => c?.producer?.audio?.id === audioPid
      );
      return producerParticipant?.userName;
    });
    io.to(socketId).emit("newProducersToConsume", {
      routerRtpCapabilities: room.router.rtpCapabilities,
      activeAudioProducers,
      activeVideoProducers,
      associatedUserNames,
      activeSpeakerList: room.activeSpeakerList.slice(0, 5),
    });
  }
}

module.exports = dominantSpeaker;
