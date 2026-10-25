import type { Metadata } from "next";
import { requireLearner } from "@/lib/server/auth";
import { getDictionary } from "@/lib/i18n/server";
import { profileFormLabels, profileFormValues } from "@/lib/server/profile";
import { db } from "@/lib/server/db";
import { DEFAULT_MODELS } from "@/lib/ai/providers";
import { ProfileForm } from "@/components/profile-form";
import { CredentialForm, DeleteAccountForm, LocaleForm, PasswordForm } from "@/components/settings/settings-forms";
import type { ReactNode } from "react";
import { Bot, Globe, KeyRound, Settings, Target, UserRound } from "lucide-react";
import { Card, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireLearner();
  const { t, locale } = await getDictionary();
  const cred = await db.apiCredential.findUnique({ where: { userId: user.id }, select: { provider: true, model: true, baseUrl: true, last4: true } });

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={t.settings.title} icon={<Settings size={20} aria-hidden="true" />} />
      <div className="grid gap-8 lg:grid-cols-[200px_1fr]">
        <nav className="hidden lg:block" aria-label={t.settings.title}>
          <ul className="sticky top-8 flex flex-col gap-0.5 text-sm">
            {[
              ["profile", t.settings.profile],
              ["language", t.settings.language],
              ["ai", t.settings.ai],
              ["password", t.settings.password],
              ["account", t.settings.account],
            ].map(([id, label]) => (
              <li key={id}>
                <a href={`#${id}`} className="block rounded px-3 py-1.5 text-muted hover:bg-surface-2 hover:text-fg">
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex min-w-0 flex-col gap-6">

      <Section id="profile" icon={<Target size={18} />} title={t.settings.profile}>
        <ProfileForm values={await profileFormValues(user.id)} labels={profileFormLabels(t, t.settings.save)} />
      </Section>

      <Section id="language" icon={<Globe size={18} />} title={t.settings.language}>
        <LocaleForm locale={locale} labels={{ language: t.settings.language }} />
      </Section>

      <Section id="ai" icon={<Bot size={18} />} title={t.settings.ai} sub={t.settings.aiBody}>
        <CredentialForm
          current={cred}
          defaults={DEFAULT_MODELS}
          labels={{ provider: t.settings.provider, model: t.settings.model, apiKey: t.settings.apiKey, baseUrl: t.settings.baseUrl, save: t.settings.save, saved: t.settings.saved, remove: t.settings.remove, test: t.settings.test }}
        />
      </Section>

      <Section id="password" icon={<KeyRound size={18} />} title={t.settings.password}>
        <PasswordForm labels={{ current: t.settings.currentPassword, next: t.settings.newPassword, save: t.settings.save, saved: t.settings.saved }} />
      </Section>

      <Section id="account" icon={<UserRound size={18} />} title={t.settings.account}>
        <div className="flex flex-col gap-6">
          <a href="/api/export" className="text-sm font-medium text-accent hover:underline">{t.settings.dataExport} (JSON)</a>
          <DeleteAccountForm labels={{ title: t.settings.deleteAccount, password: t.settings.currentPassword }} />
        </div>
      </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ id, icon, title, sub, children }: { id: string; icon: ReactNode; title: string; sub?: string; children: ReactNode }) {
  return (
    <Card className="scroll-mt-8 p-6" id={id}>
      <h2 className="flex items-center gap-2 font-semibold">
        <span className="text-accent" aria-hidden="true">
          {icon}
        </span>
        {title}
      </h2>
      {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
      <div className="mt-4">{children}</div>
    </Card>
  );
}
