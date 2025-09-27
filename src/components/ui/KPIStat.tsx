"use client";

interface KPIStatProps {
  label: string;
  value: string;
  status?: "neutral" | "warn" | "error" | "ok";
  helper?: string;
}

const STATUS_STYLES: Record<Required<KPIStatProps>["status"], string> = {
  neutral: "border-[var(--border)]",
  warn: "border-[var(--warning)]",
  error: "border-[var(--danger)]",
  ok: "border-[var(--success)]",
};

export function KPIStat({ label, value, status = "neutral", helper }: KPIStatProps) {
  return (
    <div
      className={`flex min-h-[84px] flex-col justify-center rounded-2xl border bg-[var(--surface)] px-4 py-3 shadow-sm ${
        STATUS_STYLES[status]
      }`}
    >
      <span className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">{label}</span>
      <span className="mt-1 text-xl font-semibold text-[var(--text)]">{value}</span>
      {helper ? <span className="mt-1 text-xs text-[var(--text-muted)]">{helper}</span> : null}
    </div>
  );
}
