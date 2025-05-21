const config = require("../config/config");
const newDominantSpeaker = require("../media-helpers/newDominantSpeaker");

class Room {
  constructor(roomName, worker) {
    this.roomName = roomName;
    this.worker = worker;
    this.router = null;
    this.clients = [];
    this.activeSpeakerList = [];
    this.activeSpeakerObserver = null;
  }

  addParticipant(participant) {
    this.clients.push(participant);
  }

  removeParticipant(participant) {
    this.clients = this.clients.filter(
      (p) => p.socketId !== participant.socketId
    );

    if (participant.producer?.audio?.id) {
      this.activeSpeakerList = this.activeSpeakerList.filter(
        (producerId) => producerId !== participant.producer.audio.id
      );
    }
  }

  async createRouter(io) {
    this.router = await this.worker.createRouter({
      mediaCodecs: config.routerMediaCodecs,
    });

    this.activeSpeakerObserver = await this.router.createActiveSpeakerObserver({
      interval: 300,
    });

    this.activeSpeakerObserver.on("dominantspeaker", (dominantSpeaker) =>
      newDominantSpeaker(dominantSpeaker, this, io)
    );
  }

  async close() {
    for (const participant of this.clients) {
      participant.closeAllTransports();
    }

    if (this.activeSpeakerObserver) {
      this.activeSpeakerObserver.close();
    }

    if (this.router) {
      await this.router.close();
    }
  }

  getParticipantBySocketId(socketId) {
    return this.clients.find(
      (participant) => participant.socketId === socketId
    );
  }

  getParticipantByProducerId(producerId) {
    return this.clients.find(
      (participant) =>
        participant.producer?.audio?.id === producerId ||
        participant.producer?.video?.id === producerId
    );
  }
}

module.exports = Room;
