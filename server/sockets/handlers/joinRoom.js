const Participant = require("../../classes/Participant");
const Room = require("../../classes/Room");
const getWorker = require("../../media-helpers/getWorker");
const updateActiveSpeakers = require("../../media-helpers/updateActiveSpeakers");

const handleJoinRoom = async (socket, rooms, workers, RoomData, ackCall) => {
  const participant = new Participant(RoomData.name, socket.id);

  let requestedRoom = rooms.find((room) => room.roomName === RoomData.room);
  if (!requestedRoom) {
    const workerToUse = await getWorker(workers);
    requestedRoom = new Room(RoomData.room, workerToUse);
    await requestedRoom.createRouter(socket.io);
    rooms.push(requestedRoom);
  }

  participant.room = requestedRoom;
  participant.room.addParticipant(participant);
  socket.join(participant.room.roomName);

  const activeAudioProducers = [...participant.room.activeSpeakerList];
  const activeVideoProducers = activeAudioProducers.map((aid) => {
    const producingParticipant = participant.room.clients.find(
      (c) => c?.producer?.audio?.id === aid
    );
    return producingParticipant?.producer?.video?.id;
  });

  const associatedUserNames = activeAudioProducers.map((aid) => {
    const producingParticipant = participant.room.clients.find(
      (c) => c?.producer?.audio?.id === aid
    );
    return producingParticipant?.userName;
  });

  ackCall({
    routerRtpCapabilities: participant.room.router.rtpCapabilities,
    activeAudioProducers,
    activeVideoProducers,
    associatedUserNames,
  });

  if (participant.room.clients.length > 1) {
    updateActiveSpeakers(participant.room, socket.io);
  }

  return participant;
};

module.exports = handleJoinRoom;
