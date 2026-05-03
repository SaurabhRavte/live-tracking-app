import { Consumer, EachMessagePayload } from "kafkajs";
import { kafka } from "./producer";
import { config } from "../config/env";
import { LocationEvent } from "../types";
import { getIo } from "../socket/server";

let consumer: Consumer | null = null;

/**
 * Consumer Group 1: Socket Broadcaster
 * Reads location events from Kafka and emits them to all connected Socket.IO clients.
 * This separation means: even if the socket layer is slow or crashes,
 * the DB writer (consumer group 2) still processes every event independently.
 */
export async function startSocketConsumer(): Promise<void> {
  consumer = kafka.consumer({
    groupId: config.kafka.socketConsumerGroup,
    heartbeatInterval: 3000,
    sessionTimeout: 30_000,
  });

  await consumer.connect();
  await consumer.subscribe({
    topic: config.kafka.locationTopic,
    fromBeginning: false, // only new events
  });

  await consumer.run({
    eachMessage: async (payload: EachMessagePayload) => {
      const { message } = payload;
      if (!message.value) return;

      let event: LocationEvent;
      try {
        event = JSON.parse(message.value.toString()) as LocationEvent;
      } catch {
        console.warn("[SocketConsumer] Failed to parse message, skipping");
        return;
      }

      // Validate required fields
      if (
        !event.userId ||
        typeof event.latitude !== "number" ||
        typeof event.longitude !== "number"
      ) {
        console.warn("[SocketConsumer] Invalid event shape:", event);
        return;
      }

      // Broadcast to all connected clients
      const io = getIo();
      io.emit("location:update", {
        userId: event.userId,
        userName: event.userName,
        avatarUrl: event.avatarUrl,
        latitude: event.latitude,
        longitude: event.longitude,
        accuracy: event.accuracy,
        timestamp: event.timestamp,
      });
    },
  });

  console.log("[Kafka] Socket consumer started");
}

export async function stopSocketConsumer(): Promise<void> {
  if (consumer) {
    await consumer.disconnect();
    consumer = null;
  }
}
