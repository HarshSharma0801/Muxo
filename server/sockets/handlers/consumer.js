const handleConsumeMedia = async (
  participant,
  { rtpCapabilities, pid, kind }
) => {
  try {
    if (
      !participant.room.router.canConsume({
        producerId: pid,
        rtpCapabilities,
      })
    ) {
      return "consumeFailed";
    }

    const downstreamTransport = participant.downstreamTransports.find((t) => {
      if (kind === "audio") {
        return t.associatedAudioPid === pid;
      } else if (kind === "video") {
        return t.associatedVideoPid === pid;
      }
    });

    const newConsumer = await downstreamTransport.transport.consume({
      producerId: pid,
      rtpCapabilities,
      paused: true,
    });

    participant.addConsumer(kind, newConsumer, downstreamTransport);

    return {
      producerId: pid,
      id: newConsumer.id,
      kind: newConsumer.kind,
      rtpParameters: newConsumer.rtpParameters,
    };
  } catch (error) {
    console.error(error);
    return "consumeFailed";
  }
};

const handleUnpauseConsumer = async (participant, { pid, kind }) => {
  const consumerToResume = participant.downstreamTransports.find((t) => {
    return t?.[kind].producerId === pid;
  });
  await consumerToResume[kind].resume();
};

module.exports = {
  handleConsumeMedia,
  handleUnpauseConsumer,
};
