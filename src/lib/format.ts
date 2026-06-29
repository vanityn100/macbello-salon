export function formatINR(value: number): string {
  const v = Number(value) || 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
  }).format(v);
}

export function formatNumber(value: number): string {
  const v = Number(value) || 0;
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 2
  }).format(v);
}

export function formatDate(date: string | Date): string {
  if (!date) return '-';
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return String(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch {
    return String(date);
  }
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function monthKey(date: Date = new Date()): string {
  return date.toISOString().slice(0, 7);
}

export function exportNumber(value: number | string | any): number {
  const v = Number(value) || 0;
  return Number(v.toFixed(2));
}
