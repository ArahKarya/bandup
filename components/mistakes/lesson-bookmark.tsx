import { requireLearner } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { getDictionary } from "@/lib/i18n/server";
import { LessonBookmarkStar } from "./lesson-bookmark-star";

/** Lesson bookmark toggle; loads its own state so the lesson page needs one line. */
export async function LessonBookmark({ lessonId }: { lessonId: string }) {
  const user = await requireLearner();
  const [{ t }, existing] = await Promise.all([
    getDictionary(),
    db.bookmark.findUnique({ where: { userId_kind_refId: { userId: user.id, kind: "lesson", refId: lessonId } }, select: { id: true } }),
  ]);
  return (
    <LessonBookmarkStar
      lessonId={lessonId}
      initial={existing !== null}
      labels={{
        bookmark: t.mistakes.bookmarkLesson,
        unbookmark: t.mistakes.unbookmarkLesson,
        bookmarked: t.mistakes.bookmarked,
        unbookmarked: t.mistakes.unbookmarked,
        error: t.common.error,
      }}
    />
  );
}
