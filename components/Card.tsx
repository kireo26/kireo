export default function Card({
  title,
  description,
  icon,
  className = "",
}: {
  title: string;
  description: string;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-white/5 bg-kireo-card p-6 shadow-sm ${className}`}
    >
      {icon && (
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-kireo-green/15 text-kireo-orange">
          {icon}
        </div>
      )}
      <h3 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">
        {title}
      </h3>
      <p className="mt-2 text-sm text-kireo-muted">{description}</p>
    </div>
  );
}
