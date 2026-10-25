import "server-only";

import { db } from "./db";
import type { ProfileValues } from "@/components/profile-form";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export async function getProfile(userId: string) {
  return db.profile.upsert({ where: { userId }, create: { userId }, update: {} });
}

export async function profileFormValues(userId: string): Promise<ProfileValues> {
  const p = await getProfile(userId);
  return {
    module: p.module,
    targetBand: p.targetBand,
    examDate: p.examDate ? p.examDate.toISOString().slice(0, 10) : "",
    dailyMinutes: p.dailyMinutes,
    studyDays: p.studyDays,
  };
}

export function profileFormLabels(t: Dictionary, save: string) {
  return {
    module: t.onboarding.module,
    academic: t.module.academic,
    general: t.module.general,
    target: t.onboarding.target,
    examDate: t.onboarding.examDate,
    dailyMinutes: t.onboarding.dailyMinutes,
    studyDays: t.onboarding.studyDays,
    days: t.days,
    academicDesc: t.onboarding.academicDesc,
    generalDesc: t.onboarding.generalDesc,
    bandNames: t.onboarding.bandNames,
    minutesHint: t.onboarding.minutesHint,
    save,
    saved: t.settings.saved,
  };
}
