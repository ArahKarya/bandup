import type { ReactNode } from "react";
import { CircleHelp, UserRound } from "lucide-react";
import type { ExamLabels } from "@/lib/i18n/messages/exam";
import { Logo } from "@/components/logo";
import { Kbd } from "@/components/ui";
import { ExamSettingsPanel } from "./exam-settings";
import { Popover } from "./popover";

interface ExamHeaderProps {
  candidate: string;
  title: string;
  section: string;
  labels: ExamLabels;
  /** Timer, save status, submit controls. */
  children?: ReactNode;
}

/** Top bar of the focused test, modelled on computer-delivered IELTS. */
export function ExamHeader({ candidate, title, section, labels, children }: ExamHeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border bg-surface px-4 py-2 sm:px-6">
      <Logo compact />
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs text-muted">{title}</p>
          <p className="truncate font-semibold">{section}</p>
        </div>
        <span className="hidden items-center gap-1.5 truncate border-l border-border pl-3 text-sm text-muted md:inline-flex">
          <UserRound size={14} aria-hidden="true" />
          <span className="sr-only">{labels.candidate}:</span>
          {candidate}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {children}
        <ExamSettingsPanel labels={labels} />
        <Popover label={labels.help} trigger={<><CircleHelp size={16} aria-hidden="true" /><span className="hidden md:inline">{labels.help}</span></>}>
          <HelpContent labels={labels} />
        </Popover>
      </div>
    </header>
  );
}

function HelpContent({ labels }: { labels: ExamLabels }) {
  const rows: [ReactNode, string][] = [
    [<><Kbd>←</Kbd> <Kbd>→</Kbd></>, labels.kPrevNext],
    [<><Kbd>Alt</Kbd> + <Kbd>F</Kbd></>, labels.kFlag],
    [<><Kbd>Alt</Kbd> + <Kbd>H</Kbd></>, labels.kHighlight],
    [<><Kbd>←</Kbd> <Kbd>→</Kbd> <Kbd>Home</Kbd> <Kbd>End</Kbd></>, labels.kResize],
  ];
  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-semibold">{labels.shortcuts}</h2>
      <dl className="flex flex-col gap-2">
        {rows.map(([keys, text], i) => (
          <div key={i} className="flex items-start justify-between gap-3">
            <dt className="flex shrink-0 items-center gap-0.5 text-xs">{keys}</dt>
            <dd className="text-right text-muted">{text}</dd>
          </div>
        ))}
      </dl>
      <p className="border-t border-border pt-3 text-muted">{labels.helpSelect}</p>
      <p className="text-muted">{labels.helpFlag}</p>
    </div>
  );
}
