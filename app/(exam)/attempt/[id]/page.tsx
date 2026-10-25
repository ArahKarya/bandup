import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { requireLearner } from "@/lib/server/auth";
import { getDictionary } from "@/lib/i18n/server";
import { runnerLabels } from "@/lib/i18n/labels";
import { getContent } from "@/lib/server/content";
import { closeIfExpired, findOwnAttempt, sectionsOf } from "@/lib/server/attempts";
import { parseState } from "@/lib/attempt/sections";
import { redactSet } from "@/lib/content/redact";
import { buildDrillSet } from "@/lib/content/drill";
import { finishAttemptAction } from "@/app/actions/attempts";
import { AttemptRunner, type RunnerSection } from "@/components/runner/attempt-runner";
import { ExamHeader } from "@/components/runner/exam-header";
import { ReviewShell } from "@/components/runner/review-shell";
import { MockSpeaking } from "@/components/speaking/mock-speaking";
import { AttemptReview } from "@/components/review/attempt-review";
import { Button } from "@/components/ui";
import { db } from "@/lib/server/db";
import type { QuestionSet, SpeakingTask, WritingTask } from "@/lib/content/schema";

export const metadata: Metadata = { title: "Test" };

export default async function AttemptPage({ params }: PageProps<"/attempt/[id]">) {
  const { id } = await params;
  const user = await requireLearner();
  const { t } = await getDictionary();

  const found = await findOwnAttempt(user.id, id);
  if (!found) notFound();
  let attempt = found;

  // A strict section whose time ran out while the tab was closed is closed now.
  attempt = await closeIfExpired(attempt);

  if (attempt.status !== "in_progress") {
    return (
      <ReviewShell backLabel={t.exam.backToDashboard}>
        <AttemptReview attempt={attempt} />
      </ReviewShell>
    );
  }

  const sections = await sectionsOf(attempt);
  const state = parseState(attempt.state);
  const section = sections[state.section];
  if (!section) redirect("/dashboard");

  const title =
    attempt.mode === "placement" ? t.onboarding.placementTitle : attempt.mode === "drill" ? t.mistakes.drillTitle : await titleOf(attempt.mode, attempt.contentId);
  const sectionText = (name: string) => (sections.length > 1 ? `${name} · ${state.section + 1}/${sections.length}` : name);

  if (section.kind === "speaking") {
    return (
      <SpeakingSection attemptId={attempt.id} userId={user.id} candidate={user.name} taskIds={section.taskIds} title={title} section={sectionText(t.skill.speaking)} />
    );
  }

  let runnerSection: RunnerSection;
  if (section.kind === "sets") {
    const sets = (await Promise.all(section.setIds.map((sid) => getContent("question_set", sid)))).filter((s): s is QuestionSet => s !== null);
    const asked = sets.map((s) => (section.drill?.[s.id] ? buildDrillSet(s, section.drill[s.id]) : s));
    runnerSection = { kind: "sets", skill: section.skill, sets: asked.map((s) => redactSet(s)), minutes: section.minutes };
  } else {
    const tasks = (await Promise.all(section.taskIds.map((tid) => getContent("writing_task", tid)))).filter((w): w is WritingTask => w !== null);
    // Sample answers stay on the server until the essay has been written.
    runnerSection = { kind: "writing", tasks: tasks.map((w) => ({ ...w, samples: [], tips: [] })), minutes: section.minutes };
  }

  const skillName = section.kind === "writing" ? t.skill.writing : t.skill[section.skill];
  const strict = attempt.mode !== "practice";

  return (
    <AttemptRunner
      key={`${attempt.id}-${state.section}`}
      attemptId={attempt.id}
      strict={strict}
      title={title}
      candidate={user.name}
      sectionIndex={state.section}
      sectionLabel={sectionText(skillName)}
      isLast={state.section === sections.length - 1}
      section={runnerSection}
      initialAnswers={state.answers}
      initialEssays={state.essays}
      initialAnnotations={state.annotations}
      initialFlags={state.flags}
      deadline={state.deadline}
      startedAt={state.sectionStartedAt ?? attempt.startedAt.toISOString()}
      serverNow={new Date().toISOString()}
      labels={runnerLabels(t)}
      exam={t.exam}
    />
  );
}

async function titleOf(mode: string, contentId: string): Promise<string> {
  if (mode === "mock") return (await getContent("mock_test", contentId))?.title ?? "Mock test";
  return (await getContent("question_set", contentId))?.title ?? "Practice";
}

interface SpeakingSectionProps {
  attemptId: string;
  userId: string;
  candidate: string;
  taskIds: string[];
  title: string;
  section: string;
}

async function SpeakingSection({ attemptId, userId, candidate, taskIds, title, section }: SpeakingSectionProps) {
  const { t } = await getDictionary();
  const tasks = (await Promise.all(taskIds.map((tid) => getContent("speaking_task", tid)))).filter((s): s is SpeakingTask => s !== null);
  const [submissions, cred] = await Promise.all([
    db.speakingSubmission.findMany({ where: { attemptId }, select: { taskId: true } }),
    db.apiCredential.findUnique({ where: { userId }, select: { provider: true } }),
  ]);
  // Model answers stay on the server; the examiner only needs the questions and cue card.
  const asked = tasks.map((task) => ({ ...task, samples: [], tips: [], usefulPhrases: [] }));

  return (
    <div className="flex min-h-screen flex-1 flex-col">
      <ExamHeader candidate={candidate} title={title} section={section} labels={t.exam} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 sm:px-8 sm:py-8">
        <p className="mb-5 text-muted">{t.mock.pendingWriting}</p>
        <MockSpeaking
          attemptId={attemptId}
          tasks={asked}
          done={submissions.map((s) => s.taskId)}
          canTranscribe={cred?.provider === "openai"}
          partLabel={t.speaking.part}
          labels={{ ...t.speaking, error: t.common.error }}
          exam={t.exam}
        />
        <form action={finishAttemptAction} className="mt-6 flex items-center gap-3">
          <input type="hidden" name="attemptId" value={attemptId} />
          <Button type="submit">{t.mock.finished}</Button>
          <Link href="/mock" className="text-sm text-muted hover:text-fg">
            {t.common.back}
          </Link>
        </form>
      </main>
    </div>
  );
}
