-- AlterTable
ALTER TABLE "skill_scores" ADD COLUMN     "submissionId" TEXT;

-- CreateIndex
CREATE INDEX "skill_scores_submissionId_idx" ON "skill_scores"("submissionId");
