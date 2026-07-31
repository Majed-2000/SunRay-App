-- Link our customer to their Foodics record so a phone that has been ordering at
-- the counter for months can see that history the first time it opens the app.
-- Nullable: most rows have no Foodics counterpart until the first lookup matches.

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN "foodicsId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Customer_foodicsId_key" ON "Customer"("foodicsId");
