export default function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
}) {
  return (
    <div className={`max-w-2xl ${align === "center" ? "mx-auto text-center" : ""}`}>
      {eyebrow && (
        <p className="mb-2 font-sans text-sm font-semibold uppercase tracking-wide text-kireo-orange">
          {eyebrow}
        </p>
      )}
      <h2 className="py-1 font-heading text-3xl font-bold leading-[1.25] text-kireo-light sm:text-4xl">
        {title}
      </h2>
      {description && (
        <p className="mt-4 text-base text-kireo-muted sm:text-lg">{description}</p>
      )}
    </div>
  );
}
