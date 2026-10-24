import type { QuestionSet } from "@/lib/content/schema";

/** A reading passage, set in a serif like the paper booklet, with paragraph letters. */
export function Passage({ passage }: { passage: NonNullable<QuestionSet["passage"]> }) {
  return (
    <article className="font-serif text-[1.05rem] leading-relaxed">
      <h2 className="font-sans text-xl font-semibold">{passage.title}</h2>
      {passage.subtitle && <p className="mt-1 font-sans text-sm italic text-muted">{passage.subtitle}</p>}
      <div className="mt-5 flex flex-col gap-4">
        {passage.paragraphs.map((p, i) => (
          <p key={i} className="flex gap-3">
            {p.label && <span className="w-5 shrink-0 font-sans font-bold">{p.label}</span>}
            <span className="whitespace-pre-line">{p.text}</span>
          </p>
        ))}
      </div>
    </article>
  );
}
