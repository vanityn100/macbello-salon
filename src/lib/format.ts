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
    return new Date(date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
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
