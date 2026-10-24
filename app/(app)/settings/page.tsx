import type { Metadata } from "next";
import { requireLearner } from "@/lib/server/auth";
import { getDictionary } from "@/lib/i18n/server";
import { profileFormLabels, profileFormValues } from "@/lib/server/profile";
import { db } from "@/lib/server/db";
import { DEFAULT_MODELS } from "@/lib/ai/providers";
import { ProfileForm } from "@/components/profile-form";
import { CredentialForm, DeleteAccountForm, LocaleForm, PasswordForm } from "@/components/settings/settings-forms";
import { Card, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireLearner();
  const { t, locale } = await getDictionary();
  const cred = await db.apiCredential.findUnique({ where: { userId: user.id }, select: { provider: true, model: true, baseUrl: true, last4: true } });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader title={t.settings.title} />

      <Section title={t.settings.profile}>
        <ProfileForm values={await profileFormValues(user.id)} labels={profileFormLabels(t, t.settings.save)} />
      </Section>

      <Section title={t.settings.language}>
        <LocaleForm locale={locale} labels={{ language: t.settings.language }} />
      </Section>

      <Section title={t.settings.ai} sub={t.settings.aiBody}>
        <CredentialForm
          current={cred}
          defaults={DEFAULT_MODELS}
          labels={{ provider: t.settings.provider, model: t.settings.model, apiKey: t.settings.apiKey, baseUrl: t.settings.baseUrl, save: t.settings.save, saved: t.settings.saved, remove: t.settings.remove, test: t.settings.test }}
        />
      </Section>

      <Section title={t.settings.password}>
        <PasswordForm labels={{ current: t.settings.currentPassword, next: t.settings.newPassword, save: t.settings.save, saved: t.settings.saved }} />
      </Section>

      <Section title={t.settings.account}>
        <div className="flex flex-col gap-6">
          <a href="/api/export" className="text-sm font-medium text-accent hover:underline">{t.settings.dataExport} (JSON)</a>
          <DeleteAccountForm labels={{ title: t.settings.deleteAccount, password: t.settings.currentPassword }} />
        </div>
      </Section>
    </div>
  );
}

function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <Card className="p-6">
      <h2 className="font-semibold">{title}</h2>
      {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
      <div className="mt-4">{children}</div>
    </Card>
  );
}
