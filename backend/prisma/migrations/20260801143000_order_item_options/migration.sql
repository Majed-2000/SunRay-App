-- Foodics ids on modifiers and their options: POST /orders identifies a chosen
-- option by its Foodics UUID, so order injection cannot work without them.
-- Deliberately NOT unique — Foodics defines each modifier once and shares it
-- across products, while we store one row per product, so the id repeats.
ALTER TABLE "Modifier" ADD COLUMN "foodicsId" TEXT;
ALTER TABLE "ModifierOption" ADD COLUMN "foodicsId" TEXT;

-- The options chosen on an order line, snapshotted at order time. Name, price
-- and Foodics id are copied rather than referenced: menu prices change in the
-- console, and a past invoice must keep saying what the customer actually
-- bought and paid. No foreign key back to ModifierOption on purpose — a re-sync
-- rebuilds those rows, and history must survive it.
CREATE TABLE "OrderItemOption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderItemId" TEXT NOT NULL,
    "modifierOptionId" TEXT,
    "foodicsOptionId" TEXT,
    "nameAr" TEXT NOT NULL,
    "price" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderItemOption_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "OrderItemOption_orderItemId_idx" ON "OrderItemOption"("orderItemId");
