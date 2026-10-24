import { requireLearner } from "@/lib/server/auth";
import { getDictionary } from "@/lib/i18n/server";
import { startPlacementAction } from "@/app/actions/attempts";
import { Button, Card, LinkButton, PageHeader } from "@/components/ui";

export default async function PlacementIntro() {
  await requireLearner();
  const { t } = await getDictionary();

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t.onboarding.placementTitle} />
      <Card className="flex flex-col gap-5 p-6">
        <p className="text-muted">{t.onboarding.placementBody}</p>
        <div className="flex flex-wrap gap-3">
          <form action={startPlacementAction}>
            <Button type="submit">{t.onboarding.takePlacement}</Button>
          </form>
          <LinkButton href="/dashboard" variant="secondary">{t.onboarding.skipPlacement}</LinkButton>
        </div>
      </Card>
    </div>
  );
}
