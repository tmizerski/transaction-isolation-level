/*
  Warnings:

  - You are about to drop the `Bank` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "Bank";

-- CreateTable
CREATE TABLE "banks" (
    "id" SERIAL NOT NULL,
    "owner" TEXT NOT NULL,
    "balance" INTEGER NOT NULL,

    CONSTRAINT "banks_pkey" PRIMARY KEY ("id")
);
