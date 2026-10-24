-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "ExamModule" AS ENUM ('academic', 'general');

-- CreateEnum
CREATE TYPE "ContentKind" AS ENUM ('lesson', 'vocab_deck', 'question_set', 'writing_task', 'speaking_task', 'mock_test');

-- CreateEnum
CREATE TYPE "AttemptMode" AS ENUM ('practice', 'mock', 'placement');

-- CreateEnum
CREATE TYPE "AttemptStatus" AS ENUM ('in_progress', 'submitted', 'abandoned');

-- CreateEnum
CREATE TYPE "Skill" AS ENUM ('listening', 'reading', 'writing', 'speaking', 'grammar');

-- CreateEnum
CREATE TYPE "ScoreSource" AS ENUM ('ai', 'self');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "locale" TEXT NOT NULL DEFAULT 'id',
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles" (
    "userId" TEXT NOT NULL,
    "module" "ExamModule" NOT NULL DEFAULT 'academic',
    "targetBand" DOUBLE PRECISION NOT NULL DEFAULT 6.5,
    "examDate" DATE,
    "dailyMinutes" INTEGER NOT NULL DEFAULT 45,
    "studyDays" INTEGER[] DEFAULT ARRAY[1, 2, 3, 4, 5, 6]::INTEGER[],
    "startingBand" DOUBLE PRECISION,
    "onboardedAt" TIMESTAMP(3),

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "api_credentials" (
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "baseUrl" TEXT,
    "ciphertext" TEXT NOT NULL,
    "last4" TEXT NOT NULL,
    "transcribe" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "api_credentials_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "content_items" (
    "id" TEXT NOT NULL,
    "kind" "ContentKind" NOT NULL,
    "skill" TEXT,
    "module" TEXT,
    "title" TEXT NOT NULL,
    "category" TEXT,
    "difficulty" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "unlisted" BOOLEAN NOT NULL DEFAULT false,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "payload" JSONB NOT NULL,
    "hash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_progress" (
    "userId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "quizScore" INTEGER,
    "quizMax" INTEGER,

    CONSTRAINT "lesson_progress_pkey" PRIMARY KEY ("userId","lessonId")
);

-- CreateTable
CREATE TABLE "vocab_reviews" (
    "userId" TEXT NOT NULL,
    "wordId" TEXT NOT NULL,
    "deckId" TEXT NOT NULL,
    "ease" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "interval" INTEGER NOT NULL DEFAULT 0,
    "reps" INTEGER NOT NULL DEFAULT 0,
    "lapses" INTEGER NOT NULL DEFAULT 0,
    "due" TIMESTAMP(3) NOT NULL,
    "lastReviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vocab_reviews_pkey" PRIMARY KEY ("userId","wordId")
);

-- CreateTable
CREATE TABLE "attempts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mode" "AttemptMode" NOT NULL,
    "contentId" TEXT NOT NULL,
    "contentKind" "ContentKind" NOT NULL,
    "status" "AttemptStatus" NOT NULL DEFAULT 'in_progress',
    "state" JSONB NOT NULL DEFAULT '{}',
    "result" JSONB,
    "bands" JSONB,
    "rawScore" INTEGER,
    "maxScore" INTEGER,
    "elapsedSec" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_results" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "skill" "Skill" NOT NULL,
    "category" TEXT NOT NULL,
    "correct" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "writing_submissions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "attemptId" TEXT,
    "taskId" TEXT NOT NULL,
    "task" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "wordCount" INTEGER NOT NULL,
    "durationSec" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "writing_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "writing_scores" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "source" "ScoreSource" NOT NULL,
    "criteria" JSONB NOT NULL,
    "band" DOUBLE PRECISION NOT NULL,
    "feedback" JSONB,
    "model" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "writing_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "speaking_submissions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "attemptId" TEXT,
    "taskId" TEXT NOT NULL,
    "part" INTEGER NOT NULL,
    "audioPath" TEXT,
    "transcript" TEXT NOT NULL DEFAULT '',
    "durationSec" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "speaking_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "speaking_scores" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "source" "ScoreSource" NOT NULL,
    "criteria" JSONB NOT NULL,
    "band" DOUBLE PRECISION NOT NULL,
    "feedback" JSONB,
    "model" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "speaking_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_scores" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "skill" "Skill" NOT NULL,
    "band" DOUBLE PRECISION NOT NULL,
    "source" "AttemptMode" NOT NULL,
    "attemptId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skill_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "study_logs" (
    "userId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "activity" TEXT NOT NULL,
    "minutes" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "study_logs_pkey" PRIMARY KEY ("userId","day","activity")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "sessions_expiresAt_idx" ON "sessions"("expiresAt");

-- CreateIndex
CREATE INDEX "content_items_kind_published_idx" ON "content_items"("kind", "published");

-- CreateIndex
CREATE INDEX "vocab_reviews_userId_due_idx" ON "vocab_reviews"("userId", "due");

-- CreateIndex
CREATE INDEX "attempts_userId_status_idx" ON "attempts"("userId", "status");

-- CreateIndex
CREATE INDEX "attempts_userId_submittedAt_idx" ON "attempts"("userId", "submittedAt");

-- CreateIndex
CREATE INDEX "question_results_userId_category_idx" ON "question_results"("userId", "category");

-- CreateIndex
CREATE INDEX "writing_submissions_userId_createdAt_idx" ON "writing_submissions"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "speaking_submissions_userId_createdAt_idx" ON "speaking_submissions"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "skill_scores_userId_skill_createdAt_idx" ON "skill_scores"("userId", "skill", "createdAt");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_credentials" ADD CONSTRAINT "api_credentials_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vocab_reviews" ADD CONSTRAINT "vocab_reviews_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_results" ADD CONSTRAINT "question_results_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_results" ADD CONSTRAINT "question_results_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "writing_submissions" ADD CONSTRAINT "writing_submissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "writing_submissions" ADD CONSTRAINT "writing_submissions_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "attempts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "writing_scores" ADD CONSTRAINT "writing_scores_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "writing_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "speaking_submissions" ADD CONSTRAINT "speaking_submissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "speaking_submissions" ADD CONSTRAINT "speaking_submissions_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "attempts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "speaking_scores" ADD CONSTRAINT "speaking_scores_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "speaking_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_scores" ADD CONSTRAINT "skill_scores_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_logs" ADD CONSTRAINT "study_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
