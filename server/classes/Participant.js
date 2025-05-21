const config = require("../config/config");

class Participant {
  constructor(username, socketId) {
    this.userName = username;
    this.socketId = socketId;
    this.upstreamTransport = null;
    this.producer = {};
    this.downstreamTransports = [];
    this.room = null;
  }

  addTransport(type, audioPid = null, videoPid = null) {
    return new Promise(async (resolve, reject) => {
      const { listenIps, initialAvailableOutgoingBitrate, maxIncomingBitrate } =
        config.webRtcTransport;

      const transport = await this.room.router.createWebRtcTransport({
        enableUdp: true,
        enableTcp: true,
        preferUdp: true,
        listenInfos: listenIps,
        initialAvailableOutgoingBitrate,
      });

      if (maxIncomingBitrate) {
        try {
          await transport.setMaxIncomingBitrate(maxIncomingBitrate);
        } catch (error) {
          reject(error);
        }
      }

      const transportParams = {
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
      };

      if (type === "producer") {
        this.upstreamTransport = transport;
      } else if (type === "consumer") {
        this.downstreamTransports.push({
          transport,
          associatedVideoPid: videoPid,
          associatedAudioPid: audioPid,
          audio: null,
          video: null,
        });
      }

      resolve(transportParams);
    });
  }

  addProducer(kind, producer) {
    this.producer[kind] = producer;
    if (kind === "audio") {
      this.room.activeSpeakerObserver.addProducer({
        producerId: producer.id,
      });
    }
  }

  addConsumer(kind, consumer, consumerTransport) {
    consumerTransport[kind] = consumer;
  }

  removeFromRoom() {
    if (this.room) {
      this.room.removeParticipant(this);
    }
  }

  closeAllTransports() {
    if (this.upstreamTransport) {
      this.upstreamTransport.close();
      this.upstreamTransport = null;
    }

    this.downstreamTransports.forEach((transport) => {
      if (transport.transport) {
        transport.transport.close();
      }
    });
    this.downstreamTransports = [];
  }

  removeProducer(kind) {
    if (this.producer[kind]) {
      if (kind === "audio" && this.room?.activeSpeakerObserver) {
        this.room.activeSpeakerObserver.removeProducer({
          producerId: this.producer[kind].id,
        });
      }
      this.producer[kind].close();
      this.producer[kind] = null;
    }
  }
}

module.exports = Participant;
