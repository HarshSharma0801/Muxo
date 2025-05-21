const handleRequestTransport = async (participant, { type, audioPid }) => {
  let clientTransportParams;

  if (type === "producer") {
    clientTransportParams = await participant.addTransport(type);
  } else if (type === "consumer") {
    const producingParticipant = participant.room.clients.find(
      (c) => c?.producer?.audio?.id === audioPid
    );
    const videoPid = producingParticipant?.producer?.video?.id;
    clientTransportParams = await participant.addTransport(
      type,
      audioPid,
      videoPid
    );
  }

  return clientTransportParams;
};

const handleConnectTransport = async (
  participant,
  { type, dtlsParameters, audioPid }
) => {
  if (type === "producer") {
    try {
      await participant.upstreamTransport.connect({ dtlsParameters });
      return "success";
    } catch (error) {
      console.error(error);
      return "error";
    }
  } else if (type === "consumer") {
    try {
      const downstreamTransport = participant.downstreamTransports.find(
        (t) => t.associatedAudioPid === audioPid
      );
      downstreamTransport.transport.connect({ dtlsParameters });
      return "success";
    } catch (error) {
      console.error(error);
      return "error";
    }
  }
};

module.exports = {
  handleRequestTransport,
  handleConnectTransport,
};
