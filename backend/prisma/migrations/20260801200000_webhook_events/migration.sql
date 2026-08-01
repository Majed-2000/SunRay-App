-- Raw log of Foodics webhooks.
--
-- Foodics retries an event 3 times then DROPS it forever, and sends no event id
-- of its own. So we keep every raw payload (to replay after a processing bug)
-- and derive a dedupeKey (so a retry of the same change is a no-op).
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL DEFAULT 'foodics',
    "event" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" DATETIME,
    "error" TEXT
);

CREATE UNIQUE INDEX "WebhookEvent_dedupeKey_key" ON "WebhookEvent"("dedupeKey");
CREATE INDEX "WebhookEvent_event_receivedAt_idx" ON "WebhookEvent"("event", "receivedAt");
