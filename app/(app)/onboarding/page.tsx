import { redirect } from "next/navigation";
import { requireUser } from "@/lib/server/auth";
import { getDictionary } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/dictionaries";
import { profileFormLabels, profileFormValues } from "@/lib/server/profile";
import { ProfileForm } from "@/components/profile-form";
import { OnboardingSteps } from "@/components/onboarding-steps";
import { Card } from "@/components/ui";

export default async function OnboardingPage() {
  const user = await requireUser();
  if (user.onboarded) redirect("/dashboard");
  const { t } = await getDictionary();

  return (
    <div className="mx-auto max-w-2xl">
      <OnboardingSteps current={1} labels={[t.onboarding.stepProfile, t.onboarding.stepPlacement]} stepLabel={fmt(t.onboarding.step, { n: 1 })} />
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">{t.onboarding.title}</h1>
      <Card className="p-6 sm:p-8">
        <ProfileForm values={await profileFormValues(user.id)} labels={profileFormLabels(t, t.onboarding.save)} />
      </Card>
    </div>
  );
}
