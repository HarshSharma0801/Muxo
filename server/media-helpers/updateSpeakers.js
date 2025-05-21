const updateSpeakers = (room, io) => {
  const activeSpeakers = room.activeSpeakerList.slice(0, 10);
  const mutedSpeakers = room.activeSpeakerList.slice(10);
  const newTransportsByPeer = {};

  room.members.forEach((participant) => {
    mutedSpeakers.forEach((producerId) => {
      if (participant?.producer?.audio?.id === producerId) {
        participant?.producer?.audio?.pause();
        participant?.producer?.video?.pause();
        return;
      }

      const downstreamTransport = participant.downstreamTransports.find(
        (t) =>
          t?.audio?.producerId === producerId ||
          t?.associatedAudioPid === producerId
      );
      if (downstreamTransport) {
        downstreamTransport.audio?.pause();
        downstreamTransport.video?.pause();
      }
    });

    const newSpeakersToParticipant = [];
    activeSpeakers.forEach((producerId) => {
      if (participant?.producer?.audio?.id === producerId) {
        participant?.producer?.audio?.resume();
        participant?.producer?.video?.resume();
        return;
      }

      const hasConsumer = participant.downstreamTransports.some(
        (t) => t?.associatedAudioPid === producerId
      );

      if (!hasConsumer) {
        newSpeakersToParticipant.push(producerId);
      } else {
        const downstreamTransport = participant.downstreamTransports.find(
          (t) => t?.associatedAudioPid === producerId
        );
        if (downstreamTransport) {
          downstreamTransport.audio?.resume();
          downstreamTransport.video?.resume();
        }
      }
    });

    // Only add to newTransportsByPeer if there are new speakers to consume
    if (newSpeakersToParticipant.length > 0) {
      newTransportsByPeer[participant.socketId] = newSpeakersToParticipant;
    }
  });

  // Broadcast active speakers update to the room
  io.to(room.roomName).emit("updateSpeakers", activeSpeakers);

  return newTransportsByPeer;
};

module.exports = updateSpeakers;
