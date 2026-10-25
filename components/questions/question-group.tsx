"use client";

import { createContext, useContext } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ReactNode } from "react";
import type { QuestionGroup } from "@/lib/content/schema";
import type { AnswerMap, GradedItem } from "@/lib/scoring/grade";
import { assetUrl } from "@/lib/content/assets";

/**
 * Renders one group of questions for any of the five group types. The same component
 * serves the runner (with `onAnswer`) and the review screen (with `results`, read-only).
 */

export interface GroupProps {
  group: QuestionGroup;
  answers: AnswerMap;
  onAnswer?: (key: string, value: string | string[]) => void;
  results?: Map<number, GradedItem>;
  labels: { choose: string; letters: string; yourAnswer: string; correctAnswer: string; evidence: string };
}

const BLANK = /\{\{(\d+)\}\}/g;

/**
 * Extension points so features can decorate questions without editing this file: the
 * runner adds a flag toggle, the review screen a bookmark star and clickable evidence.
 */
export interface QuestionExtras {
  /** Rendered under each question number (n is the first number of a "choose TWO" item). */
  actions?: (n: number) => ReactNode;
  /** Makes "Where to find it" clickable, e.g. to scroll to the paragraph. */
  onEvidence?: (evidence: string, n: number) => void;
}

export const QuestionExtrasContext = createContext<QuestionExtras>({});

export function QuestionGroupView(props: GroupProps) {
  const { group } = props;
  const first = group.type === "mcq_multi" ? group.questions[0]?.numbers[0] : group.questions[0]?.n;
  const last = group.type === "mcq_multi" ? group.questions.at(-1)?.numbers.at(-1) : group.questions.at(-1)?.n;

  return (
    <section className="flex flex-col gap-4" aria-label={`Questions ${first}–${last}`}>
      <div>
        <h3 className="font-semibold">
          Questions {first}
          {last !== first ? `–${last}` : ""}
        </h3>
        <p className="mt-1 whitespace-pre-line text-sm text-muted">{group.instructions}</p>
      </div>
      {group.image && (
        // eslint-disable-next-line @next/next/no-img-element -- SVGs from content/assets, sized by their viewBox
        <img src={assetUrl(group.image)} alt="Diagram for these questions" className="max-h-[420px] w-full rounded border border-border bg-white object-contain p-2" />
      )}
      <GroupBody {...props} />
    </section>
  );
}

function GroupBody(props: GroupProps) {
  const { group } = props;
  switch (group.type) {
    case "mcq_single":
      return <McqSingle {...props} group={group} />;
    case "mcq_multi":
      return <McqMulti {...props} group={group} />;
    case "tfng":
      return <Tfng {...props} group={group} />;
    case "matching":
      return <Matching {...props} group={group} />;
    case "completion":
      return <Completion {...props} group={group} />;
  }
}

type Of<T extends QuestionGroup["type"]> = Extract<QuestionGroup, { type: T }>;

function Num({ n, item }: { n: number | string; item?: GradedItem }) {
  const { actions } = useContext(QuestionExtrasContext);
  const first = typeof n === "number" ? n : Number.parseInt(n, 10);
  const extra = actions?.(first);
  if (extra) {
    return (
      <span className="flex shrink-0 flex-col items-center gap-1">
        <NumBadge n={n} item={item} />
        {extra}
      </span>
    );
  }
  return <NumBadge n={n} item={item} />;
}

function NumBadge({ n, item }: { n: number | string; item?: GradedItem }) {
  const tone = item ? (item.correct ? "border-success bg-success-soft text-success" : "border-danger bg-danger-soft text-danger") : "border-border bg-surface-2";
  return <span className={`inline-flex h-7 min-w-7 shrink-0 items-center justify-center rounded border px-1 text-sm font-semibold tabular-nums ${tone}`}>{n}</span>;
}

function Feedback({ item, labels }: { item?: GradedItem; labels: GroupProps["labels"] }) {
  if (!item) return null;
  return (
    <div className={`mt-2 rounded px-3 py-2 text-sm ${item.correct ? "bg-success-soft" : "bg-danger-soft"}`}>
      {!item.correct && (
        <p>
          <span className="text-muted">{labels.yourAnswer}:</span> {item.given || "—"} ·{" "}
          <span className="text-muted">{labels.correctAnswer}:</span> <strong>{item.expected}</strong>
        </p>
      )}
      {item.explanation && <p className="mt-1">{item.explanation}</p>}
      {item.evidence && <Evidence item={item} label={labels.evidence} />}
    </div>
  );
}

function Choice({
  name,
  value,
  checked,
  disabled,
  type = "radio",
  onChange,
  children,
}: {
  name: string;
  value: string;
  checked: boolean;
  disabled: boolean;
  type?: "radio" | "checkbox";
  onChange: () => void;
  children: ReactNode;
}) {
  return (
    <label className={`flex items-start gap-3 rounded border px-3 py-2 text-sm ${checked ? "border-accent bg-accent-soft" : "border-border"} ${disabled ? "" : "cursor-pointer hover:bg-surface-2"}`}>
      <input type={type} name={name} value={value} checked={checked} disabled={disabled} onChange={onChange} className="mt-0.5 accent-[var(--accent)]" />
      <span>{children}</span>
    </label>
  );
}

function Evidence({ item, label, inline = false }: { item: GradedItem; label: string; inline?: boolean }) {
  const { onEvidence } = useContext(QuestionExtrasContext);
  const text = `${label}: ${item.evidence}`;
  const body = onEvidence ? (
    <button type="button" onClick={() => onEvidence(item.evidence!, item.n)} className="text-accent underline decoration-dotted underline-offset-2 hover:decoration-solid">
      {text}
    </button>
  ) : (
    text
  );
  return inline ? <>{body}</> : <p className="mt-1 text-xs text-muted">{body}</p>;
}

function McqSingle({ group, answers, onAnswer, results, labels }: GroupProps & { group: Of<"mcq_single"> }) {
  return (
    <ol className="flex flex-col gap-5">
      {group.questions.map((q) => {
        const item = results?.get(q.n);
        return (
          <li key={q.n} id={`q-${q.n}`} className="scroll-mt-24">
            <div className="mb-2 flex gap-3">
              <Num n={q.n} item={item} />
              <p className="pt-0.5">{q.prompt}</p>
            </div>
            <div className="flex flex-col gap-1.5 pl-10">
              {q.options.map((o) => (
                <Choice key={o.key} name={`q${q.n}`} value={o.key} checked={answers[q.n] === o.key} disabled={!onAnswer} onChange={() => onAnswer?.(String(q.n), o.key)}>
                  <strong className="mr-1.5">{o.key}</strong>
                  {o.text}
                </Choice>
              ))}
            </div>
            <div className="pl-10">
              <Feedback item={item} labels={labels} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function McqMulti({ group, answers, onAnswer, results, labels }: GroupProps & { group: Of<"mcq_multi"> }) {
  return (
    <ol className="flex flex-col gap-5">
      {group.questions.map((q) => {
        const key = String(q.numbers[0]);
        const raw = answers[key];
        const picked = Array.isArray(raw) ? raw : [];
        const items = q.numbers.map((n) => results?.get(n)).filter((i): i is GradedItem => Boolean(i));
        const toggle = (k: string) => {
          if (!onAnswer) return;
          if (picked.includes(k)) onAnswer(key, picked.filter((p) => p !== k));
          else if (picked.length < q.numbers.length) onAnswer(key, [...picked, k]);
        };
        return (
          <li key={key} id={`q-${key}`} className="scroll-mt-24">
            <div className="mb-2 flex gap-3">
              <Num n={`${q.numbers[0]}–${q.numbers.at(-1)}`} item={items.length ? { ...items[0], correct: items.every((i) => i.correct) } : undefined} />
              <div className="pt-0.5">
                <p>{q.prompt}</p>
                <p className="text-xs text-muted">
                  {labels.choose} {q.numbers.length} {labels.letters} ({picked.length}/{q.numbers.length})
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-1.5 pl-10">
              {q.options.map((o) => (
                <Choice key={o.key} type="checkbox" name={`q${key}`} value={o.key} checked={picked.includes(o.key)} disabled={!onAnswer || (!picked.includes(o.key) && picked.length >= q.numbers.length)} onChange={() => toggle(o.key)}>
                  <strong className="mr-1.5">{o.key}</strong>
                  {o.text}
                </Choice>
              ))}
            </div>
            {items.length > 0 && (
              <div className="pl-10">
                <Feedback
                  item={{ ...items[0], correct: items.every((i) => i.correct), given: picked.join(", "), expected: items.map((i) => i.expected).join(", ") }}
                  labels={labels}
                />
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function Tfng({ group, answers, onAnswer, results, labels }: GroupProps & { group: Of<"tfng"> }) {
  const choices = group.variant === "tfng" ? ["TRUE", "FALSE", "NOT GIVEN"] : ["YES", "NO", "NOT GIVEN"];
  return (
    <ol className="flex flex-col gap-4">
      {group.questions.map((q) => {
        const item = results?.get(q.n);
        return (
          <li key={q.n} id={`q-${q.n}`} className="scroll-mt-24">
            <div className="flex gap-3">
              <Num n={q.n} item={item} />
              <div className="flex-1">
                <p className="pt-0.5">{q.statement}</p>
                <div className="mt-2 flex flex-wrap gap-1.5" role="radiogroup">
                  {choices.map((c) => {
                    const active = answers[q.n] === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        disabled={!onAnswer}
                        onClick={() => onAnswer?.(String(q.n), c)}
                        className={`rounded border px-3 py-1 text-xs font-semibold tracking-wide ${active ? "border-accent bg-accent text-accent-fg" : "border-border bg-surface text-muted hover:text-fg"}`}
                      >
                        {c}
                      </button>
                    );
                  })}
                </div>
                <Feedback item={item} labels={labels} />
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function OptionsBox({ title, options }: { title?: string; options: { key: string; text: string }[] }) {
  return (
    <div className="rounded border border-border bg-surface-2 p-3 text-sm">
      {title && <p className="mb-1.5 font-semibold">{title}</p>}
      <ul className="grid gap-1 sm:grid-cols-2">
        {options.map((o) => (
          <li key={o.key} className="flex gap-2">
            <strong className="w-8 shrink-0">{o.key}</strong>
            <span>{o.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function LetterSelect({ n, options, value, onAnswer, item }: { n: number; options: { key: string }[]; value: string; onAnswer?: GroupProps["onAnswer"]; item?: GradedItem }) {
  return (
    <select
      aria-label={`Answer ${n}`}
      value={value}
      disabled={!onAnswer}
      onChange={(e) => onAnswer?.(String(n), e.target.value)}
      className={`h-9 min-w-20 rounded border bg-surface px-2 text-sm ${item ? (item.correct ? "border-success" : "border-danger") : "border-border"}`}
    >
      <option value="">—</option>
      {options.map((o) => (
        <option key={o.key} value={o.key}>
          {o.key}
        </option>
      ))}
    </select>
  );
}

function Matching({ group, answers, onAnswer, results, labels }: GroupProps & { group: Of<"matching"> }) {
  const showBox = !group.image || group.options.some((o) => o.text.length > 2);
  return (
    <div className="flex flex-col gap-4">
      {showBox && <OptionsBox options={group.options} />}
      <ol className="flex flex-col gap-3">
        {group.questions.map((q) => {
          const item = results?.get(q.n);
          return (
            <li key={q.n} id={`q-${q.n}`} className="scroll-mt-24">
              <div className="flex flex-wrap items-center gap-3">
                <Num n={q.n} item={item} />
                <p className="min-w-0 flex-1">{q.prompt}</p>
                <LetterSelect n={q.n} options={group.options} value={String(answers[q.n] ?? "")} onAnswer={onAnswer} item={item} />
              </div>
              <div className="pl-10">
                <Feedback item={item} labels={labels} />
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Blank({ n, value, onAnswer, item, wordBank }: { n: number; value: string; onAnswer?: GroupProps["onAnswer"]; item?: GradedItem; wordBank?: { key: string }[] }) {
  const tone = item ? (item.correct ? "border-success bg-success-soft" : "border-danger bg-danger-soft") : "border-border bg-surface";
  if (wordBank) {
    return (
      <span className="mx-0.5 inline-flex items-center gap-1 align-middle" id={`q-${n}`}>
        <strong className="text-xs text-muted">{n}</strong>
        <LetterSelect n={n} options={wordBank} value={value} onAnswer={onAnswer} item={item} />
      </span>
    );
  }
  return (
    <span className="mx-0.5 inline-flex items-center gap-1 align-middle" id={`q-${n}`}>
      <strong className="text-xs text-muted">{n}</strong>
      <input
        type="text"
        aria-label={`Answer ${n}`}
        value={value}
        readOnly={!onAnswer}
        autoComplete="off"
        spellCheck={false}
        maxLength={80}
        onChange={(e) => onAnswer?.(String(n), e.target.value)}
        className={`h-8 w-36 rounded border px-2 text-sm ${tone}`}
      />
      {item && !item.correct && <span className="text-xs font-medium text-success">({item.expected})</span>}
    </span>
  );
}

/** Splits text on {{n}} and puts an input in each blank. */
function withBlanks(text: string, render: (n: number) => ReactNode): ReactNode[] {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(BLANK)) {
    parts.push(text.slice(last, m.index));
    parts.push(<span key={`b${m[1]}-${m.index}`}>{render(Number(m[1]))}</span>);
    last = (m.index ?? 0) + m[0].length;
  }
  parts.push(text.slice(last));
  return parts;
}

function Completion({ group, answers, onAnswer, results, labels }: GroupProps & { group: Of<"completion"> }) {
  const blank = (n: number) => <Blank n={n} value={String(answers[n] ?? "")} onAnswer={onAnswer} item={results?.get(n)} wordBank={group.wordBank} />;
  const explained = group.questions.map((q) => results?.get(q.n)).filter((i): i is GradedItem => Boolean(i?.explanation || i?.evidence));

  return (
    <div className="flex flex-col gap-4">
      {group.wordBank && <OptionsBox options={group.wordBank} />}
      {group.template ? (
        <div className="prose-content rounded border border-border bg-surface p-4">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              // Blanks are turned into inline code before parsing so they survive inside tables and lists.
              code: ({ children }) => {
                const m = /^__BLANK_(\d+)__$/.exec(String(children));
                return m ? blank(Number(m[1])) : <code>{children}</code>;
              },
            }}
          >
            {group.template.replace(BLANK, (_, n: string) => `\`__BLANK_${n}__\``)}
          </ReactMarkdown>
        </div>
      ) : (
        <ol className="flex flex-col gap-3">
          {group.questions.map((q) => (
            <li key={q.n} className="flex gap-3 leading-9">
              <Num n={q.n} item={results?.get(q.n)} />
              <p className="flex-1">{withBlanks(q.prompt ?? `{{${q.n}}}`, blank)}</p>
            </li>
          ))}
        </ol>
      )}
      {explained.length > 0 && (
        <ul className="flex flex-col gap-1">
          {explained.map((item) => (
            <li key={item.n} className="text-sm">
              <strong>{item.n}.</strong> <span className={item.correct ? "text-success" : "text-danger"}>{item.expected}</span>
              {item.explanation && <> — {item.explanation}</>}
              {item.evidence && (
                <span className="text-xs text-muted">
                  {" ("}
                  <Evidence item={item} label={labels.evidence} inline />
                  {")"}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
