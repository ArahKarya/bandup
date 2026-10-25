import type { ReactNode } from "react";
import type { QuestionSet } from "@/lib/content/schema";
import type { Annotation } from "@/lib/attempt/sections";

/** DOM id of a passage paragraph, so evidence links and annotations can find it. */
export function passageBlockId(setId: string, index: number): string {
  return `p-${setId}-${index}`;
}

interface PassageProps {
  passage: NonNullable<QuestionSet["passage"]>;
  /** Set id, used to give each paragraph a stable DOM id. */
  setId?: string;
  /** Highlights and notes to draw (read-only unless a runner wraps the passage). */
  annotations?: Annotation[];
  /** Renders a paragraph's text; the runner swaps in an annotation-aware renderer. */
  renderText?: (text: string, index: number) => ReactNode;
}

/** A reading passage, set in a serif like the paper booklet, with paragraph letters. */
export function Passage({ passage, setId = "set", renderText }: PassageProps) {
  return (
    <article className="font-serif text-[1.05em] leading-relaxed">
      <h2 className="font-sans text-xl font-semibold">{passage.title}</h2>
      {passage.subtitle && <p className="mt-1 font-sans text-sm italic text-muted">{passage.subtitle}</p>}
      <div className="mt-5 flex flex-col gap-4">
        {passage.paragraphs.map((p, i) => (
          <p key={i} id={passageBlockId(setId, i)} data-label={p.label} data-block={i} className="flex scroll-mt-24 gap-3 rounded">
            {p.label && <span className="w-5 shrink-0 font-sans font-bold">{p.label}</span>}
            <span className="whitespace-pre-line" data-block-text={i}>
              {renderText ? renderText(p.text, i) : p.text}
            </span>
          </p>
        ))}
      </div>
    </article>
  );
}
