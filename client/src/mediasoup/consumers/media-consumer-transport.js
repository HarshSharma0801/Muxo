const initializeConsumerTransport = (
  transportParams,
  device,
  socket,
  audioPid
) => {
  const consumerTransport = device.createRecvTransport(transportParams);

  consumerTransport.on(
    "connect",
    async ({ dtlsParameters }, callback, errback) => {
      const connectResp = await socket.emitWithAck("connectTransport", {
        dtlsParameters,
        type: "consumer",
        audioPid,
      });
      if (connectResp === "success") {
        callback();
      } else {
        errback();
      }
    }
  );

  return consumerTransport;
};

export default initializeConsumerTransport;
