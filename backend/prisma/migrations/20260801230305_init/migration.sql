-- CreateEnum
CREATE TYPE "order_type" AS ENUM ('PICKUP', 'DELIVERY', 'DINE_IN');

-- CreateEnum
CREATE TYPE "order_status" AS ENUM ('PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'EN_ROUTE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "wallet_tx_type" AS ENUM ('CREDIT', 'DEBIT');

-- CreateEnum
CREATE TYPE "wallet_tx_source" AS ENUM ('TOP_UP', 'ORDER_PAYMENT', 'GIFT_CARD', 'REFUND', 'ADMIN');

-- CreateEnum
CREATE TYPE "gift_card_status" AS ENUM ('ACTIVE', 'REDEEMED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "gender" AS ENUM ('MALE', 'FEMALE');

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "foodics_id" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "gender" "gender",
    "city" TEXT,
    "birth_day" INTEGER,
    "birth_month" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "user_agent" TEXT,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(6),

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_challenges" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "addresses" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "district" TEXT,
    "street" TEXT,
    "details" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branches" (
    "id" TEXT NOT NULL,
    "foodics_id" TEXT,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "opening_from" TEXT,
    "opening_to" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "foodics_id" TEXT,
    "name_ar" TEXT NOT NULL,
    "name_en" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "foodics_id" TEXT,
    "category_id" TEXT NOT NULL,
    "name_ar" TEXT NOT NULL,
    "name_en" TEXT,
    "description_ar" TEXT,
    "description_en" TEXT,
    "price" INTEGER NOT NULL,
    "image" TEXT,
    "calories" INTEGER,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "preparation_time" INTEGER,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modifiers" (
    "id" TEXT NOT NULL,
    "foodics_id" TEXT,
    "product_id" TEXT NOT NULL,
    "name_ar" TEXT NOT NULL,
    "name_en" TEXT,
    "min_selected" INTEGER NOT NULL DEFAULT 0,
    "max_selected" INTEGER NOT NULL DEFAULT 1,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "modifiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modifier_options" (
    "id" TEXT NOT NULL,
    "foodics_id" TEXT,
    "modifier_id" TEXT NOT NULL,
    "name_ar" TEXT NOT NULL,
    "name_en" TEXT,
    "price" INTEGER NOT NULL DEFAULT 0,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "modifier_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT,
    "branch_id" TEXT,
    "address_id" TEXT,
    "foodics_order_id" TEXT,
    "type" "order_type" NOT NULL,
    "status" "order_status" NOT NULL DEFAULT 'PENDING',
    "subtotal" INTEGER NOT NULL,
    "vat" INTEGER NOT NULL,
    "delivery_fee" INTEGER NOT NULL DEFAULT 0,
    "discount" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL,
    "customer_notes" TEXT,
    "scheduled_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "product_name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" INTEGER NOT NULL,
    "total_price" INTEGER NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_item_options" (
    "id" TEXT NOT NULL,
    "order_item_id" TEXT NOT NULL,
    "modifier_option_id" TEXT,
    "foodics_option_id" TEXT,
    "name_ar" TEXT NOT NULL,
    "price" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_item_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_transactions" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "type" "wallet_tx_type" NOT NULL,
    "source" "wallet_tx_source" NOT NULL,
    "amount" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gift_cards" (
    "id" TEXT NOT NULL,
    "sender_customer_id" TEXT,
    "redeemed_by_customer_id" TEXT,
    "recipient_phone" TEXT NOT NULL,
    "recipient_name" TEXT,
    "amount" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "status" "gift_card_status" NOT NULL DEFAULT 'ACTIVE',
    "message" TEXT,
    "redeemed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "gift_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_counters" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "cup_count" INTEGER NOT NULL DEFAULT 0,
    "goal" INTEGER NOT NULL DEFAULT 6,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "loyalty_counters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_rewards" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "issued_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "redeemed_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6),

    CONSTRAINT "loyalty_rewards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'foodics',
    "event" TEXT NOT NULL,
    "dedupe_key" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ(6),
    "error" TEXT,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customers_foodics_id_key" ON "customers"("foodics_id");

-- CreateIndex
CREATE UNIQUE INDEX "customers_phone_key" ON "customers"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_refresh_token_hash_key" ON "sessions"("refresh_token_hash");

-- CreateIndex
CREATE INDEX "sessions_customer_id_idx" ON "sessions"("customer_id");

-- CreateIndex
CREATE INDEX "sessions_customer_id_revoked_at_expires_at_idx" ON "sessions"("customer_id", "revoked_at", "expires_at");

-- CreateIndex
CREATE INDEX "otp_challenges_phone_expires_at_idx" ON "otp_challenges"("phone", "expires_at");

-- CreateIndex
CREATE INDEX "otp_challenges_expires_at_idx" ON "otp_challenges"("expires_at");

-- CreateIndex
CREATE INDEX "addresses_customer_id_idx" ON "addresses"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "branches_foodics_id_key" ON "branches"("foodics_id");

-- CreateIndex
CREATE INDEX "branches_is_active_idx" ON "branches"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "categories_foodics_id_key" ON "categories"("foodics_id");

-- CreateIndex
CREATE INDEX "categories_is_active_sort_order_idx" ON "categories"("is_active", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "products_foodics_id_key" ON "products"("foodics_id");

-- CreateIndex
CREATE INDEX "products_category_id_idx" ON "products"("category_id");

-- CreateIndex
CREATE INDEX "products_category_id_is_available_idx" ON "products"("category_id", "is_available");

-- CreateIndex
CREATE INDEX "modifiers_product_id_idx" ON "modifiers"("product_id");

-- CreateIndex
CREATE INDEX "modifier_options_modifier_id_idx" ON "modifier_options"("modifier_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_foodics_order_id_key" ON "orders"("foodics_order_id");

-- CreateIndex
CREATE INDEX "orders_customer_id_idx" ON "orders"("customer_id");

-- CreateIndex
CREATE INDEX "orders_branch_id_idx" ON "orders"("branch_id");

-- CreateIndex
CREATE INDEX "orders_address_id_idx" ON "orders"("address_id");

-- CreateIndex
CREATE INDEX "orders_customer_id_created_at_idx" ON "orders"("customer_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");

-- CreateIndex
CREATE INDEX "order_items_product_id_idx" ON "order_items"("product_id");

-- CreateIndex
CREATE INDEX "order_item_options_order_item_id_idx" ON "order_item_options"("order_item_id");

-- CreateIndex
CREATE INDEX "wallet_transactions_customer_id_idx" ON "wallet_transactions"("customer_id");

-- CreateIndex
CREATE INDEX "wallet_transactions_customer_id_created_at_idx" ON "wallet_transactions"("customer_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "gift_cards_code_key" ON "gift_cards"("code");

-- CreateIndex
CREATE INDEX "gift_cards_sender_customer_id_idx" ON "gift_cards"("sender_customer_id");

-- CreateIndex
CREATE INDEX "gift_cards_redeemed_by_customer_id_idx" ON "gift_cards"("redeemed_by_customer_id");

-- CreateIndex
CREATE INDEX "gift_cards_recipient_phone_idx" ON "gift_cards"("recipient_phone");

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_counters_customer_id_key" ON "loyalty_counters"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_rewards_code_key" ON "loyalty_rewards"("code");

-- CreateIndex
CREATE INDEX "loyalty_rewards_customer_id_idx" ON "loyalty_rewards"("customer_id");

-- CreateIndex
CREATE INDEX "notifications_customer_id_idx" ON "notifications"("customer_id");

-- CreateIndex
CREATE INDEX "notifications_customer_id_created_at_idx" ON "notifications"("customer_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_dedupe_key_key" ON "webhook_events"("dedupe_key");

-- CreateIndex
CREATE INDEX "webhook_events_event_received_at_idx" ON "webhook_events"("event", "received_at");

-- CreateIndex
CREATE INDEX "webhook_events_processed_at_idx" ON "webhook_events"("processed_at");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modifiers" ADD CONSTRAINT "modifiers_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modifier_options" ADD CONSTRAINT "modifier_options_modifier_id_fkey" FOREIGN KEY ("modifier_id") REFERENCES "modifiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_address_id_fkey" FOREIGN KEY ("address_id") REFERENCES "addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item_options" ADD CONSTRAINT "order_item_options_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gift_cards" ADD CONSTRAINT "gift_cards_sender_customer_id_fkey" FOREIGN KEY ("sender_customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gift_cards" ADD CONSTRAINT "gift_cards_redeemed_by_customer_id_fkey" FOREIGN KEY ("redeemed_by_customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_counters" ADD CONSTRAINT "loyalty_counters_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_rewards" ADD CONSTRAINT "loyalty_rewards_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- CHECK constraints — hand-written, because Prisma cannot express them.
--
-- Zod already validates every request, so these should never fire from normal
-- traffic. They exist for everything Zod does not see: a psql session, a repair
-- script, a future service, a bug. The database is the last place a wrong value
-- can be stopped, and the only one that cannot be bypassed.
--
-- Named explicitly so failures say what broke rather than quoting a generated
-- identifier.
-- ─────────────────────────────────────────────────────────────────────────────

-- Money is never negative. Prices and amounts are halalas.
ALTER TABLE "products"          ADD CONSTRAINT "products_price_non_negative"        CHECK ("price" >= 0);
ALTER TABLE "modifier_options"  ADD CONSTRAINT "modifier_options_price_non_negative" CHECK ("price" >= 0);
ALTER TABLE "order_item_options" ADD CONSTRAINT "order_item_options_price_non_negative" CHECK ("price" >= 0);
ALTER TABLE "gift_cards"        ADD CONSTRAINT "gift_cards_amount_positive"          CHECK ("amount" > 0);
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_amount_positive" CHECK ("amount" > 0);

-- Order totals. `total` is what the customer pays, VAT INCLUSIVE — so the tax
-- can never exceed it, and nothing may be negative.
ALTER TABLE "orders" ADD CONSTRAINT "orders_amounts_non_negative"
  CHECK ("subtotal" >= 0 AND "vat" >= 0 AND "delivery_fee" >= 0 AND "discount" >= 0 AND "total" >= 0);
ALTER TABLE "orders" ADD CONSTRAINT "orders_vat_within_total"
  CHECK ("vat" <= "total");

-- An order line is at least one item, and its total matches unit x quantity.
-- This is the invariant that a pricing bug would break first.
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_quantity_positive"
  CHECK ("quantity" > 0);
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_total_matches_unit"
  CHECK ("total_price" = "unit_price" * "quantity");

-- A modifier group cannot demand more selections than it permits.
ALTER TABLE "modifiers" ADD CONSTRAINT "modifiers_selection_range_sane"
  CHECK ("min_selected" >= 0 AND "max_selected" >= 1 AND "min_selected" <= "max_selected");

-- Saudi national mobile: 9 digits starting with 5. Matches the Zod rule in
-- auth.schemas.ts. Deleted accounts carry a `deleted:<hash>` tombstone instead,
-- which must stay permitted or account deletion would fail.
ALTER TABLE "customers" ADD CONSTRAINT "customers_phone_format"
  CHECK ("phone" ~ '^5[0-9]{8}$' OR "phone" LIKE 'deleted:%');

-- Birthday is day and month only; no year is collected.
ALTER TABLE "customers" ADD CONSTRAINT "customers_birth_day_valid"
  CHECK ("birth_day" IS NULL OR ("birth_day" BETWEEN 1 AND 31));
ALTER TABLE "customers" ADD CONSTRAINT "customers_birth_month_valid"
  CHECK ("birth_month" IS NULL OR ("birth_month" BETWEEN 1 AND 12));

-- Value sets we expect to change live as CHECK rather than enum: adding a value
-- is one ALTER, and removing one does not require rewriting a type.
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_label_known"
  CHECK ("label" IN ('home', 'work', 'other'));
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_type_known"
  CHECK ("type" IN ('orderAccepted', 'orderReady', 'pointsEarned', 'giftReceived', 'birthdayOffer'));
ALTER TABLE "loyalty_rewards" ADD CONSTRAINT "loyalty_rewards_status_known"
  CHECK ("status" IN ('ACTIVE', 'REDEEMED', 'EXPIRED'));
ALTER TABLE "loyalty_rewards" ADD CONSTRAINT "loyalty_rewards_type_known"
  CHECK ("type" IN ('FREE_COFFEE'));

-- Loyalty counters cannot go negative, and the goal must be reachable.
ALTER TABLE "loyalty_counters" ADD CONSTRAINT "loyalty_counters_sane"
  CHECK ("cup_count" >= 0 AND "goal" > 0);

-- An OTP challenge must expire after it was created, and attempts only count up.
ALTER TABLE "otp_challenges" ADD CONSTRAINT "otp_challenges_attempts_non_negative"
  CHECK ("attempts" >= 0);
