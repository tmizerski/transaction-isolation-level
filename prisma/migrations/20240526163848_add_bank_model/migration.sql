-- CreateTable
CREATE TABLE "Bank" (
    "id" SERIAL NOT NULL,
    "owner" TEXT NOT NULL,
    "balance" INTEGER NOT NULL,

    CONSTRAINT "Bank_pkey" PRIMARY KEY ("id")
);
