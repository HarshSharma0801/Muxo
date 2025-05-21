const initializeProducerTransport = (socket, device) =>
  new Promise(async (resolve, reject) => {
    // ask the server to make a transport and send params
    const producerTransportParams = await socket.emitWithAck(
      "requestTransport",
      { type: "producer" }
    );

    // create a send producer transport from front-end
    const producerTransport = device.createSendTransport(
      producerTransportParams
    );

    // listen for producerTransport connect event - won't fire until producerTransport.produce runs in createProducer function
    producerTransport.on(
      "connect",
      async ({ dtlsParameters }, callback, errBack) => {
        // emit connect transport

        const connectResp = await socket.emitWithAck("connectTransport", {
          dtlsParameters,
          type: "producer",
        });

        if (connectResp === "success") {
          // we are connected
          callback();
        } else {
          errBack();
        }
      }
    );

    // listen for produce event
    producerTransport.on("produce", async (parameters, callback, errBack) => {
      // emit produce transport

      const { kind, rtpParameters } = parameters;
      const produceResp = await socket.emitWithAck("startProducing", {
        kind,
        rtpParameters,
      });
      if (produceResp === "error") {
        errBack();
      } else {
        callback({ id: produceResp });
      }
    });

    resolve(producerTransport);
  });

export default initializeProducerTransport;
