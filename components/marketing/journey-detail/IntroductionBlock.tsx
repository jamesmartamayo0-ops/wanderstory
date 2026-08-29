interface IntroductionBlockProps {
  introduction: string;
}

export default function IntroductionBlock({
  introduction,
}: IntroductionBlockProps) {
  return (
    <section aria-label="Introduction" className="bg-[var(--color-surface)] px-6 py-20 sm:py-28">
      <div className="mx-auto max-w-3xl">
        <p className="font-[family-name:var(--font-body)] text-lg leading-relaxed text-[var(--color-text-secondary)] sm:text-xl">
          {introduction}
        </p>
      </div>
    </section>
  );
}
