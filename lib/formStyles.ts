export const inputClass =
  "w-full rounded-lg border bg-kireo-dark px-4 py-3 text-base text-kireo-light placeholder:text-kireo-muted focus:outline-none disabled:cursor-not-allowed disabled:opacity-50";

export function fieldBorder(hasError: boolean) {
  return hasError ? "border-red-500/60 focus:border-red-500" : "border-white/10 focus:border-kireo-green";
}
