import Link from 'next/link';

/**
 * Renders a plan-limit error (from PlanLimitsService.assertCanCreate, which
 * always includes the word "upgrade") as an actionable banner with a link to
 * /pricing. Any other error message falls back to a plain red error line.
 */
export function UpgradeBanner({ message }: { message: string }) {
  const isLimitError = message.toLowerCase().includes('upgrade');

  if (!isLimitError) {
    return <p className="text-sm text-red-500 mb-4">{message}</p>;
  }

  return (
    <div className="mb-6 flex items-center justify-between gap-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      <span>{message}</span>
      <Link href="/pricing" className="font-semibold underline whitespace-nowrap">
        View plans
      </Link>
    </div>
  );
}
