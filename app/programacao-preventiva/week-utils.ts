// ─── ISO Week Utilities (pure functions, no "use server") ─────────────────────

export function calcISOWeek(dateStr: string): number {
  const date = new Date(dateStr + "T12:00:00")
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

export function mondayOfISOWeek(week: number, year: number): string {
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const dayNum = jan4.getUTCDay() || 7
  const monday = new Date(jan4)
  monday.setUTCDate(jan4.getUTCDate() - dayNum + 1 + (week - 1) * 7)
  return monday.toISOString().slice(0, 10)
}

export function sundayOfISOWeek(week: number, year: number): string {
  const mon = new Date(mondayOfISOWeek(week, year) + "T12:00:00")
  mon.setUTCDate(mon.getUTCDate() + 6)
  return mon.toISOString().slice(0, 10)
}
