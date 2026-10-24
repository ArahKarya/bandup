import { redirect } from "next/navigation";
import { requireUser } from "@/lib/server/auth";
import { getDictionary } from "@/lib/i18n/server";
import { profileFormLabels, profileFormValues } from "@/lib/server/profile";
import { ProfileForm } from "@/components/profile-form";
import { Card, PageHeader } from "@/components/ui";

export default async function OnboardingPage() {
  const user = await requireUser();
  if (user.onboarded) redirect("/dashboard");
  const { t } = await getDictionary();

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t.onboarding.title} />
      <Card className="p-6">
        <ProfileForm values={await profileFormValues(user.id)} labels={profileFormLabels(t, t.onboarding.save)} />
      </Card>
    </div>
  );
}
