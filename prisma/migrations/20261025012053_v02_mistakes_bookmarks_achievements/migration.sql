-- AlterEnum
ALTER TYPE "AttemptMode" ADD VALUE 'drill';

-- CreateTable
CREATE TABLE "mistake_items" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "setId" TEXT NOT NULL,
    "n" INTEGER NOT NULL,
    "skill" "Skill" NOT NULL,
    "category" TEXT NOT NULL,
    "given" TEXT NOT NULL,
    "expected" TEXT NOT NULL,
    "attemptId" TEXT,
    "correctStreak" INTEGER NOT NULL DEFAULT 0,
    "mastered" BOOLEAN NOT NULL DEFAULT false,
    "timesWrong" INTEGER NOT NULL DEFAULT 1,
    "lastDrilledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mistake_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookmarks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "refId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bookmarks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "achievements" (
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "seen" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "achievements_pkey" PRIMARY KEY ("userId","key")
);

-- CreateIndex
CREATE INDEX "mistake_items_userId_mastered_updatedAt_idx" ON "mistake_items"("userId", "mastered", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "mistake_items_userId_setId_n_key" ON "mistake_items"("userId", "setId", "n");

-- CreateIndex
CREATE INDEX "bookmarks_userId_createdAt_idx" ON "bookmarks"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "bookmarks_userId_kind_refId_key" ON "bookmarks"("userId", "kind", "refId");

-- AddForeignKey
ALTER TABLE "mistake_items" ADD CONSTRAINT "mistake_items_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
