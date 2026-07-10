import { Compass, Users, Leaf } from "lucide-react";
import { aboutData } from "@/data/about";

const iconMap: Record<string, React.ReactNode> = {
  Compass: <Compass className="h-6 w-6 text-white" aria-hidden="true" />,
  Users: <Users className="h-6 w-6 text-white" aria-hidden="true" />,
  Leaf: <Leaf className="h-6 w-6 text-white" aria-hidden="true" />,
};

const circleColors = [
  "var(--color-ocean-600)",
  "var(--color-forest-600)",
  "var(--color-sunset-400)",
];

export default function About() {
  const { heroTitle, heroSubtitle, heroDescription, missionTitle, missionDescription, values } =
    aboutData;

  return (
    <>
      <section
        aria-label="About hero"
        className="bg-[var(--color-surface-alt)] px-6 pt-32 pb-20 sm:pb-28"
      >
        <div className="mx-auto max-w-3xl text-center">
          <span className="font-[family-name:var(--font-button)] text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-sunset-400)]">
            {heroSubtitle}
          </span>

          <h1 className="mt-3 font-[family-name:var(--font-heading)] text-4xl font-semibold leading-tight tracking-tight text-[var(--color-ink-950)] sm:text-5xl">
            {heroTitle}
          </h1>

          <p className="mx-auto mt-5 max-w-2xl font-[family-name:var(--font-body)] text-base leading-relaxed text-neutral-500 sm:text-lg">
            {heroDescription}
          </p>
        </div>
      </section>

      <section
        aria-label="Mission"
        className="bg-[var(--color-surface)] px-6 py-20 sm:py-28"
      >
        <div className="mx-auto max-w-3xl text-center">
          <span className="font-[family-name:var(--font-button)] text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-sunset-400)]">
            Why We Exist
          </span>

          <h2 className="mt-3 font-[family-name:var(--font-heading)] text-3xl font-semibold leading-tight tracking-tight text-[var(--color-ink-950)] sm:text-4xl">
            {missionTitle}
          </h2>

          <p className="mx-auto mt-5 max-w-2xl font-[family-name:var(--font-body)] text-base leading-relaxed text-neutral-500">
            {missionDescription}
          </p>
        </div>
      </section>

      <section
        aria-label="Values"
        className="bg-[var(--color-surface-alt)] px-6 py-20 sm:py-28"
      >
        <div className="mx-auto max-w-6xl">
          <div className="mb-14 text-center">
            <span className="font-[family-name:var(--font-button)] text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-sunset-400)]">
              What Guides Us
            </span>

            <h2 className="mt-3 font-[family-name:var(--font-heading)] text-3xl font-semibold leading-tight tracking-tight text-[var(--color-ink-950)] sm:text-4xl">
              Our Values
            </h2>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {values.map((value, index) => (
              <article
                key={value.id}
                className="flex flex-col items-center text-center"
              >
                <div
                  className="mb-5 flex h-16 w-16 items-center justify-center rounded-full"
                  style={{
                    backgroundColor:
                      circleColors[index % circleColors.length],
                  }}
                >
                  {iconMap[value.icon]}
                </div>

                <h3 className="font-[family-name:var(--font-heading)] text-xl font-semibold text-[var(--color-ink-950)]">
                  {value.title}
                </h3>

                <p className="mt-2 max-w-xs font-[family-name:var(--font-body)] text-sm leading-relaxed text-neutral-500">
                  {value.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
