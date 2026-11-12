export function SampleDataNotice() {
  if (!import.meta.env.DEV || import.meta.env.VITE_FEATURE_MOCKS !== "true") return null;
  return (
    <p
      role="note"
      className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
    >
      Local sample data. Changes reset when you reload; no real records are changed.
    </p>
  );
}
