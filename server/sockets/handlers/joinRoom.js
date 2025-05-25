const Participant = require("../../classes/Participant");
const Room = require("../../classes/Room");
const getWorker = require("../../media-helpers/getWorker");
const updateSpeakers = require("../../media-helpers/updateSpeakers");

const handleJoinRoom = async (
  socket,
  rooms,
  workers,
  RoomData,
  ackCall,
  hlsManager
) => {
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
    const producingParticipant = participant.room.members.find(
      (c) => c?.producer?.audio?.id === aid
    );
    return producingParticipant?.producer?.video?.id;
  });

  const associatedUserNames = activeAudioProducers.map((aid) => {
    const producingParticipant = participant.room.members.find(
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

  if (participant.room.members.length > 1) {
    updateSpeakers(participant.room, socket.io);
  }

  return participant;
};

module.exports = handleJoinRoom;
