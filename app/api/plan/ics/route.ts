import { currentUser } from "@/lib/server/auth";
import { studyPlanFor } from "@/lib/server/stats";
import { APP_TIMEZONE, calendarToday } from "@/lib/stats/dates";
import { buildIcs, zonedTime, type IcsEvent } from "@/lib/stats/ics";
import { dictionaries, fmt, isLocale } from "@/lib/i18n/dictionaries";
import { activityText } from "@/components/plan/activity-list";

/** The learner's next weeks of study plan as an iCalendar file: reminders without push or email. */

const EXPORT_WEEKS = 8;
const STUDY_HOUR = 19;
/** A mock day is long; cap the calendar block so it stays a reminder, not a wall. */
const MAX_EVENT_MINUTES = 180;

export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const t = dictionaries[isLocale(user.locale) ? user.locale : "id"];
  const plan = await studyPlanFor(user.id, calendarToday());
  const origin = new URL(req.url).origin;

  const events: IcsEvent[] = plan.weeks
    .slice(0, EXPORT_WEEKS)
    .flatMap((w) => w.days)
    .filter((d) => d.activities.length > 0)
    .map((day) => {
      const minutes = day.activities.reduce((s, a) => s + a.minutes, 0);
      return {
        uid: `${day.date}-${user.id}@bandup`,
        start: zonedTime(day.date, STUDY_HOUR, 0, APP_TIMEZONE),
        minutes: Math.min(MAX_EVENT_MINUTES, minutes),
        summary: fmt(t.motivation.calendar.eventTitle, { minutes }),
        description: [...day.activities.map((a) => `• ${activityText(a, t)} (${a.minutes} ${t.common.minutes})`), "", `${t.motivation.calendar.open}: ${origin}/plan`].join("\n"),
        url: `${origin}/plan`,
      };
    });

  return new Response(buildIcs(events, t.motivation.calendar.calName), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="bandup-plan.ics"',
      "Cache-Control": "private, no-store",
    },
  });
}
