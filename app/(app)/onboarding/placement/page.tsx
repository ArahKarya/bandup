import { CheckCircle2, Clock, Target } from "lucide-react";
import { requireLearner } from "@/lib/server/auth";
import { getDictionary } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/dictionaries";
import { startPlacementAction } from "@/app/actions/attempts";
import { OnboardingSteps } from "@/components/onboarding-steps";
import { Button, Card, LinkButton } from "@/components/ui";

export default async function PlacementIntro() {
  await requireLearner();
  const { t } = await getDictionary();

  return (
    <div className="mx-auto max-w-2xl">
      <OnboardingSteps current={2} labels={[t.onboarding.stepProfile, t.onboarding.stepPlacement]} stepLabel={fmt(t.onboarding.step, { n: 2 })} />
      <Card className="flex flex-col gap-6 p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-accent-soft text-accent">
            <Target size={24} aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{t.onboarding.placementTitle}</h1>
            <p className="mt-1 text-muted">{t.onboarding.placementBody}</p>
          </div>
        </div>
        <ul className="flex flex-col gap-2 rounded bg-surface-2 p-4 text-sm">
          {t.onboarding.placementPoints.map((p) => (
            <li key={p} className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-accent" aria-hidden="true" />
              {p}
            </li>
          ))}
          <li className="flex items-center gap-2 text-muted">
            <Clock size={16} aria-hidden="true" />
            {t.onboarding.placementMinutes}
          </li>
        </ul>
        <div className="flex flex-wrap gap-3">
          <form action={startPlacementAction}>
            <Button type="submit" size="lg">
              {t.onboarding.takePlacement}
            </Button>
          </form>
          <LinkButton href="/dashboard" variant="secondary" size="lg">
            {t.onboarding.skipPlacement}
          </LinkButton>
        </div>
      </Card>
    </div>
  );
}
