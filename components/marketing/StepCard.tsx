import { Compass, Map, Mountain } from "lucide-react";
import type { HowItWorksStep } from "@/data/how-it-works";

interface StepCardProps {
  step: HowItWorksStep;
  circleColor: string;
}

function renderIcon(name: string) {
  const className = "h-6 w-6 text-white";
  switch (name) {
    case "Compass":
      return <Compass className={className} aria-hidden="true" />;
    case "Map":
      return <Map className={className} aria-hidden="true" />;
    case "Mountain":
      return <Mountain className={className} aria-hidden="true" />;
    default:
      return null;
  }
}

export default function StepCard({ step, circleColor }: StepCardProps) {
  return (
    <article className="flex flex-col items-center text-center">
      <div
        className="mb-5 flex h-16 w-16 items-center justify-center rounded-full"
        style={{ backgroundColor: circleColor }}
      >
        {renderIcon(step.icon)}
      </div>

      <span className="font-[family-name:var(--font-button)] text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-sunset-400)]">
        Step {step.stepNumber}
      </span>

      <h3 className="mt-2 font-[family-name:var(--font-heading)] text-xl font-semibold text-[var(--color-ink-950)]">
        {step.title}
      </h3>

      <p className="mt-2 max-w-xs font-[family-name:var(--font-body)] text-sm leading-relaxed text-neutral-500">
        {step.description}
      </p>
    </article>
  );
}
