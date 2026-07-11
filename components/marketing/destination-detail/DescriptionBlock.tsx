interface DescriptionBlockProps {
  description: string | null;
}

export default function DescriptionBlock({
  description,
}: DescriptionBlockProps) {
  if (!description) return null;

  return (
    <section
      aria-label="Description"
      className="bg-[var(--color-surface)] px-6 py-20 sm:py-28"
    >
      <div className="mx-auto max-w-3xl">
        <p className="font-[family-name:var(--font-body)] text-lg leading-relaxed text-[var(--color-ink-950)]/80 sm:text-xl">
          {description}
        </p>
      </div>
    </section>
  );
}
