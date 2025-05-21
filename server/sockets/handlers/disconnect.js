const updateSpeakers = require("../../media-helpers/updateSpeakers");

const handleDisconnect = async (participant, socket, rooms) => {
  if (!participant || !participant.room) return;

  try {
    const room = participant.room;

    room.removeParticipant(participant);

    if (participant.producer?.audio?.id) {
      room.activeSpeakerList = room.activeSpeakerList.filter(
        (pid) => pid !== participant.producer.audio.id
      );
    }

    if (participant.upstreamTransport) {
      participant.upstreamTransport.close();
    }

    if (participant.downstreamTransports) {
      participant.downstreamTransports.forEach((transport) => {
        transport.transport.close();
      });
    }

    const othermembers = room.members.filter((c) => c.socketId !== socket.id);

    if (participant.producer?.audio?.id || participant.producer?.video?.id) {
      othermembers.forEach((otherClient) => {
        socket.io.to(otherClient.socketId).emit("producerClosed", {
          audioPid: participant.producer?.audio?.id,
          videoPid: participant.producer?.video?.id,
        });
      });
    }

    if (room.members.length === 0) {
      rooms = rooms.filter((r) => r.roomName !== room.roomName);
      await room.router.close();
    } else {
      updateSpeakers(room, socket.io);
    }
  } catch (error) {
    console.error("Error during cleanup:", error);
  }
};

const handleHangUp = async (participant, socket, rooms) => {
  try {
    if (!participant || !participant.room) {
      return "success";
    }

    const room = participant.room;

    room.removeParticipant(participant);

    if (participant.producer?.audio?.id) {
      room.activeSpeakerList = room.activeSpeakerList.filter(
        (pid) => pid !== participant.producer.audio.id
      );
    }

    if (participant.upstreamTransport) {
      participant.upstreamTransport.close();
    }

    if (participant.downstreamTransports) {
      participant.downstreamTransports.forEach((transport) => {
        transport.transport.close();
      });
    }

    const othermembers = room.members.filter((c) => c.socketId !== socket.id);

    if (participant.producer?.audio?.id || participant.producer?.video?.id) {
      othermembers.forEach((otherClient) => {
        socket.io.to(otherClient.socketId).emit("producerClosed", {
          audioPid: participant.producer?.audio?.id,
          videoPid: participant.producer?.video?.id,
        });
      });
    }

    if (room.members.length === 0) {
      rooms = rooms.filter((r) => r.roomName !== room.roomName);
      await room.router.close();
    } else {
      updateSpeakers(room, socket.io);
    }

    return "success";
  } catch (error) {
    console.error("Error during hangup:", error);
    return "error";
  }
};

module.exports = {
  handleDisconnect,
  handleHangUp,
};
