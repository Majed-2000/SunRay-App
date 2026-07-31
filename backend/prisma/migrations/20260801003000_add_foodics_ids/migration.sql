-- Map our rows to their Foodics counterparts so menu sync can upsert instead of
-- duplicating. Nullable: rows created by the original seed have no Foodics id,
-- and SQLite treats each NULL as distinct, so the unique index tolerates many.

-- AlterTable
ALTER TABLE "Branch" ADD COLUMN "foodicsId" TEXT;
ALTER TABLE "Category" ADD COLUMN "foodicsId" TEXT;
ALTER TABLE "Product" ADD COLUMN "foodicsId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Branch_foodicsId_key" ON "Branch"("foodicsId");
CREATE UNIQUE INDEX "Category_foodicsId_key" ON "Category"("foodicsId");
CREATE UNIQUE INDEX "Product_foodicsId_key" ON "Product"("foodicsId");
