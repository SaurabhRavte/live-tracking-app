import { Consumer, EachMessagePayload } from "kafkajs";
import { kafka } from "./producer";
import { config } from "../config/env";
import { LocationEvent } from "../types";
import { insertLocationEvent } from "../services/db";

let consumer: Consumer | null = null;

/**
 * Consumer Group 2: Database Writer
 * Reads location events from Kafka and persists them to PostgreSQL.
 *
 * Why Kafka + separate consumer instead of direct DB writes on each socket event:
 * - A single active user can emit 60+ events/min. Direct writes under heavy load
 *   would saturate the DB connection pool and add latency to every socket handler.
 * - Kafka acts as a buffer: the socket handler just produces a message (<1ms),
 *   while this consumer processes writes at a sustainable rate.
 * - Consumer groups let us add more processors (analytics, alerts) independently.
 * - If the DB is temporarily unavailable, Kafka retains messages — no data loss.
 *
 * The event_id field enforces idempotency: duplicate events (e.g. from retries)
 * are safely ignored via ON CONFLICT DO NOTHING.
 */
export async function startDbConsumer(): Promise<void> {
  consumer = kafka.consumer({
    groupId: config.kafka.dbConsumerGroup,
    heartbeatInterval: 3000,
    sessionTimeout: 30_000,
  });

  await consumer.connect();
  await consumer.subscribe({
    topic: config.kafka.locationTopic,
    fromBeginning: false,
  });

  await consumer.run({
    eachMessage: async (payload: EachMessagePayload) => {
      const { message } = payload;
      if (!message.value) return;

      let event: LocationEvent;
      try {
        event = JSON.parse(message.value.toString()) as LocationEvent;
      } catch {
        console.warn("[DbConsumer] Failed to parse message, skipping");
        return;
      }

      // Validate
      if (
        !event.userId ||
        !event.eventId ||
        typeof event.latitude !== "number" ||
        typeof event.longitude !== "number"
      ) {
        console.warn("[DbConsumer] Invalid event, skipping:", event);
        return;
      }

      await insertLocationEvent({
        userId: event.userId,
        latitude: event.latitude,
        longitude: event.longitude,
        accuracy: event.accuracy,
        eventId: event.eventId,
        recordedAt: new Date(event.timestamp),
      });
    },
  });

  console.log("[Kafka] DB consumer started");
}

export async function stopDbConsumer(): Promise<void> {
  if (consumer) {
    await consumer.disconnect();
    consumer = null;
  }
}
