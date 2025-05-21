const initializeMediaConsumer = (
  consumerTransport,
  pid,
  device,
  socket,
  kind,
  slot
) => {
  return new Promise(async (resolve, reject) => {
    // consume from the basics, emit the consumeMedia event, we take
    // the params we get back, and run .consume(). That gives us our track
    const consumerParams = await socket.emitWithAck("consumeMedia", {
      rtpCapabilities: device.rtpCapabilities,
      pid,
      kind,
    });

    if (consumerParams === "cannotConsume") {
      resolve();
    } else if (consumerParams === "consumeFailed") {
      resolve();
    } else {
      // we got valid params! Use them to consume
      const consumer = await consumerTransport.consume(consumerParams);
      const { track } = consumer;
      // add track events
      //unpause
      await socket.emitWithAck("unpauseConsumer", { pid, kind });
      resolve(consumer);
    }
  });
};

export default initializeMediaConsumer;
