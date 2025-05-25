const updateSpeakers = require("../../media-helpers/updateSpeakers");

const handleDisconnect = async (participant, socket, rooms, hlsManager) => {
  if (!participant || !participant.room) {
    console.log("Participant or room not found during disconnect");
    return;
  }

  const room = participant.room;
  const roomName = room.roomName;

  // Close all transports for the participant
  participant.closeAllTransports();

  // Remove participant from room
  participant.removeFromRoom();

  // Notify other participants about producer closure
  if (participant.producer?.audio?.id || participant.producer?.video?.id) {
    socket.to(roomName).emit("producerClosed", {
      audioPid: participant.producer?.audio?.id,
      videoPid: participant.producer?.video?.id,
    });
  }

  console.log(
    `Participant ${participant.userName} disconnected from room ${roomName}`
  );

  // Check if room is empty or has no more producers
  const hasProducers = room.members.some(
    (member) => member.producer.video || member.producer.audio
  );

  if (room.members.length === 0) {
    // Room is empty, remove it and stop HLS stream
    const roomIndex = rooms.findIndex((r) => r.roomName === roomName);
    if (roomIndex !== -1) {
      await room.close();
      rooms.splice(roomIndex, 1);
      console.log(`Room ${roomName} closed and removed`);
    }

    if (hlsManager) {
      await hlsManager.stopHLSStream(roomName);
    }
  } else if (!hasProducers && hlsManager) {
    // No more producers, stop HLS stream but keep room
    await hlsManager.stopHLSStream(roomName);
  } else if (hlsManager) {
    // Update HLS stream with remaining producers
    await hlsManager.updateStream(roomName, room);
  }

  // Update speakers for remaining participants
  if (room.members.length > 0) {
    updateSpeakers(room, socket.io);
  }
};

const handleHangUp = async (participant, socket, rooms, hlsManager) => {
  if (!participant || !participant.room) {
    console.log("Participant or room not found during hangup");
    return { success: false };
  }

  const room = participant.room;
  const roomName = room.roomName;

  // Close all transports for the participant
  participant.closeAllTransports();

  // Remove participant from room
  participant.removeFromRoom();

  // Leave the socket room
  socket.leave(roomName);

  // Notify other participants about producer closure
  if (participant.producer?.audio?.id || participant.producer?.video?.id) {
    socket.to(roomName).emit("producerClosed", {
      audioPid: participant.producer?.audio?.id,
      videoPid: participant.producer?.video?.id,
    });
  }

  console.log(
    `Participant ${participant.userName} hung up from room ${roomName}`
  );

  // Check if room is empty or has no more producers
  const hasProducers = room.members.some(
    (member) => member.producer.video || member.producer.audio
  );

  if (room.members.length === 0) {
    // Room is empty, remove it and stop HLS stream
    const roomIndex = rooms.findIndex((r) => r.roomName === roomName);
    if (roomIndex !== -1) {
      await room.close();
      rooms.splice(roomIndex, 1);
      console.log(`Room ${roomName} closed and removed`);
    }

    if (hlsManager) {
      await hlsManager.stopHLSStream(roomName);
    }
  } else if (!hasProducers && hlsManager) {
    // No more producers, stop HLS stream but keep room
    await hlsManager.stopHLSStream(roomName);
  } else if (hlsManager) {
    // Update HLS stream with remaining producers
    await hlsManager.updateStream(roomName, room);
  }

  // Update speakers for remaining participants
  if (room.members.length > 0) {
    updateSpeakers(room, socket.io);
  }

  return { success: true };
};

module.exports = { handleDisconnect, handleHangUp };
