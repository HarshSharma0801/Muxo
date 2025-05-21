const initializeMediaProducers = (localStream, producerTransport) => {
  return new Promise(async (resolve, reject) => {
    const videoTrack = localStream.getVideoTracks()[0];
    const audioTrack = localStream.getAudioTracks()[0];

    try {
      const videoProducer = await producerTransport.produce({
        track: videoTrack,
      });
      const audioProducer = await producerTransport.produce({
        track: audioTrack,
      });

      resolve({ videoProducer, audioProducer });
    } catch (error) {
      reject(error);
    }
  });
};

export default initializeMediaProducers;
