const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const num = new Intl.NumberFormat("en-IN");

export const rupees = (paise: number) => inr.format(paise / 100);
export const fmtNum = (n: number) => num.format(n);
export const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : "—";
export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });

export function fmtBytes(b: number) {
  if (b < 1024 ** 2) return `${num.format(Math.round(b / 1024))} KB`;
  if (b < 1024 ** 3) return `${num.format(Math.round(b / 1024 ** 2))} MB`;
  return `${(b / 1024 ** 3).toFixed(1)} GB`;
}
