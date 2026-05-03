import { Kafka, Producer, logLevel } from "kafkajs";
import { config } from "../config/env";
import { LocationEvent } from "../types";

const kafka = new Kafka({
  clientId: "location-tracker-server",
  brokers: config.kafka.brokers,
  logLevel: config.isDev ? logLevel.WARN : logLevel.ERROR,
  retry: {
    initialRetryTime: 300,
    retries: 10,
  },
});

let producer: Producer | null = null;

export async function connectProducer(): Promise<void> {
  producer = kafka.producer({
    allowAutoTopicCreation: true,
    transactionTimeout: 30_000,
  });
  await producer.connect();
  console.log("[Kafka] Producer connected");
}

export async function publishLocationEvent(
  event: LocationEvent
): Promise<void> {
  if (!producer) {
    console.warn("[Kafka] Producer not connected, skipping publish");
    return;
  }

  await producer.send({
    topic: config.kafka.locationTopic,
    messages: [
      {
        key: event.userId, // partition by userId → ordered per user
        value: JSON.stringify(event),
      },
    ],
  });
}

export async function disconnectProducer(): Promise<void> {
  if (producer) {
    await producer.disconnect();
    producer = null;
  }
}

export { kafka };
