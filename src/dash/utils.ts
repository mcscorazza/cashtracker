import { supabase } from '../supabaseClient'

const DEFAULT_LIMIT_WARNING = 1500
const DEFAULT_LIMIT_DANGER = 2000

export type Expense = {
  id: string
  amount: number
  description: string
  expense_date: string
  categories: { name: string; icon: string } | null
}

export type CatStat = { name: string; icon: string; total: number; count: number }

export const brl = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export const pad = (n: number) => String(n).padStart(2, '0')
export const ymd = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`
export const dateStr = (d: Date) => ymd(d.getFullYear(), d.getMonth(), d.getDate())
export const catName = (e: Expense) => e.categories?.name ?? 'Sem categoria'

export function limitColor(total: number) {
  const warning = Number(localStorage.getItem('ct_limit_warning')) || DEFAULT_LIMIT_WARNING
  const danger = Number(localStorage.getItem('ct_limit_danger')) || DEFAULT_LIMIT_DANGER
  if (total > danger) return '#e05a5a'
  if (total > warning) return '#fbbf24'
  return 'var(--text-main)'
}

export async function fetchRange(start: string, end: string): Promise<Expense[]> {
  const { data, error } = await supabase
    .from('expenses')
    .select('id, amount, description, expense_date, categories(name, icon)')
    .gte('expense_date', start)
    .lte('expense_date', end)
    .order('expense_date', { ascending: false })
    .limit(5000)
  if (error) throw error
  return (data ?? []) as unknown as Expense[]
}

export function categoryStats(expenses: Expense[]): CatStat[] {
  const cats: Record<string, CatStat> = {}
  for (const e of expenses) {
    const name = catName(e)
    cats[name] ??= { name, icon: e.categories?.icon ?? '❓', total: 0, count: 0 }
    cats[name].total += Number(e.amount)
    cats[name].count++
  }
  return Object.values(cats).sort((a, b) => b.total - a.total)
}
