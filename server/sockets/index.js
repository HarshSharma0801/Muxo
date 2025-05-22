const handleJoinRoom = require("./handlers/joinRoom");
const {
  handleRequestTransport,
  handleConnectTransport,
} = require("./handlers/transport");
const { handleStartProducing } = require("./handlers/producer");
const {
  handleConsumeMedia,
  handleUnpauseConsumer,
} = require("./handlers/consumer");
const { handleDisconnect, handleHangUp } = require("./handlers/disconnect");

const setupSocketHandlers = (io, rooms, workers) => {
  io.on("connect", (socket) => {
    let participant;

    socket.io = io;

    socket.on("join", async (RoomData, ackCall) => {
      participant = await handleJoinRoom(
        socket,
        rooms,
        workers,
        RoomData,
        ackCall
      );
    });

    socket.on("request-transport", async (data, ackCall) => {
      const result = await handleRequestTransport(participant, data);
      ackCall(result);
    });

    socket.on("connect-transport", async (data, ackCall) => {
      const result = await handleConnectTransport(participant, data);
      ackCall(result);
    });

    socket.on("produce", async (data, ackCall) => {
      const result = await handleStartProducing(participant, data, socket);
      ackCall(result);
    });

    socket.on("consume", async (data, ackCall) => {
      const result = await handleConsumeMedia(participant, data);
      ackCall(result);
    });

    socket.on("unpause", async (data, ackCall) => {
      await handleUnpauseConsumer(participant, data);
      ackCall();
    });

    socket.on("disconnect", async () => {
      await handleDisconnect(participant, socket, rooms);
    });

    socket.on("hangUp", async (ackCall) => {
      const result = await handleHangUp(participant, socket, rooms);
      ackCall(result);
    });
  });
};

module.exports = setupSocketHandlers;
