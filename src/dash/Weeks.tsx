import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import { AuthGate, CategoryCard, ExpenseTable, TopNav } from './shared'
import { brl, categoryStats, dateStr, fetchRange, limitColor, pad } from './utils'
import type { Expense } from './utils'

const TREND_WEEKS = 12
const WEEKDAYS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom']

function mondayOf(d: Date) {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  r.setDate(r.getDate() - ((r.getDay() + 6) % 7))
  return r
}
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
const short = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`

export default function Weeks() {
  return <AuthGate><WeeksContent /></AuthGate>
}

function WeeksContent() {
  const today = new Date()
  const currentMonday = mondayOf(today)
  const [monday, setMonday] = useState(currentMonday)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [catFilter, setCatFilter] = useState('')

  const mondayKey = dateStr(monday)
  const isCurrentWeek = mondayKey === dateStr(currentMonday)

  // Uma única consulta cobre a semana selecionada + as 11 anteriores (para a tendência)
  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError('')
      try {
        const m = new Date(mondayKey + 'T00:00:00')
        const data = await fetchRange(dateStr(addDays(m, -7 * (TREND_WEEKS - 1))), dateStr(addDays(m, 6)))
        if (!cancelled) setExpenses(data)
      } catch (e) {
        if (!cancelled) setError((e as Error).message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [mondayKey])

  const view = useMemo(() => {
    const startKey = mondayKey
    const endKey = dateStr(addDays(monday, 6))

    const weekTotals = Array.from({ length: TREND_WEEKS }, (_, i) => {
      const start = addDays(monday, -7 * (TREND_WEEKS - 1 - i))
      return { start, key: dateStr(start), total: 0 }
    })
    const byKey = new Map(weekTotals.map((w) => [w.key, w]))
    for (const e of expenses) {
      const [y, m, d] = e.expense_date.split('-').map(Number)
      const w = byKey.get(dateStr(mondayOf(new Date(y, m - 1, d))))
      if (w) w.total += Number(e.amount)
    }

    const week = expenses.filter((e) => e.expense_date >= startKey && e.expense_date <= endKey)
    const total = week.reduce((s, e) => s + Number(e.amount), 0)
    const daily = Array.from({ length: 7 }, () => 0)
    let biggest: Expense | null = null
    for (const e of week) {
      const [y, m, d] = e.expense_date.split('-').map(Number)
      daily[(new Date(y, m - 1, d).getDay() + 6) % 7] += Number(e.amount)
      if (!biggest || Number(e.amount) > Number(biggest.amount)) biggest = e
    }

    const elapsed = isCurrentWeek ? ((today.getDay() + 6) % 7) + 1 : 7
    const avg = total / elapsed
    const prev = weekTotals[TREND_WEEKS - 2].total
    const others = weekTotals.slice(0, -1).filter((w) => w.total > 0)
    const trendAvg = others.length ? others.reduce((s, w) => s + w.total, 0) / others.length : 0

    return {
      week, total, daily, biggest, avg, prev, trendAvg, weekTotals, elapsed,
      projection: isCurrentWeek ? avg * 7 : total,
      cats: categoryStats(week),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenses, mondayKey, isCurrentWeek])

  const shiftWeek = (n: number) => { setMonday(addDays(monday, 7 * n)); setCatFilter('') }
  const goTo = (d: Date) => { setMonday(d); setCatFilter('') }

  const sunday = addDays(monday, 6)
  const label = `${short(monday)} – ${short(sunday)}/${sunday.getFullYear()}`
  const diff = view.prev > 0 ? ((view.total - view.prev) / view.prev) * 100 : null
  const vsAvg = view.trendAvg > 0 ? ((view.total - view.trendAvg) / view.trendAvg) * 100 : null
  const maxDaily = Math.max(...view.daily, 1)
  const maxTrend = Math.max(...view.weekTotals.map((w) => w.total), 1)
  const todayIdx = (today.getDay() + 6) % 7

  return (
    <div className="dash">
      <div className="dash-top">
        <div className="dash-left">
          <h1>💱 Corazza CashTracker</h1>
          <TopNav current="weeks" />
        </div>
        <div className="dash-actions">
          <button onClick={() => shiftWeek(-1)}>←</button>
          <span className="dash-month" style={{ textTransform: 'none' }}>{label}</span>
          <button onClick={() => shiftWeek(1)} disabled={isCurrentWeek}>→</button>
          <button onClick={() => goTo(currentMonday)} disabled={isCurrentWeek}>Hoje</button>
          <button onClick={() => supabase.auth.signOut()}>Sair</button>
        </div>
      </div>

      {error && <div className="card" style={{ color: '#e05a5a', marginBottom: '1rem' }}>Erro ao carregar: {error}</div>}
      {loading && <p className="muted">Carregando...</p>}

      <div className="kpis" style={{ opacity: loading ? 0.5 : 1 }}>
        <div className="card">
          <h3>Total da semana</h3>
          <div className="kpi-value" style={{ color: limitColor(view.total) }}>{brl(view.total)}</div>
          <div className="kpi-sub">
            {diff === null ? 'Sem dados na semana anterior'
              : `${diff >= 0 ? '▲' : '▼'} ${Math.abs(diff).toFixed(0)}% vs semana anterior (${brl(view.prev)})`}
          </div>
        </div>
        <div className="card">
          <h3>Média por dia</h3>
          <div className="kpi-value">{brl(view.avg)}</div>
          <div className="kpi-sub">{isCurrentWeek ? `${view.elapsed} de 7 dias decorridos` : '7 dias'}</div>
        </div>
        <div className="card">
          <h3>{isCurrentWeek ? 'Projeção da semana' : 'Fechamento'}</h3>
          <div className="kpi-value" style={{ color: limitColor(view.projection) }}>{brl(view.projection)}</div>
          <div className="kpi-sub">{isCurrentWeek ? 'Mantendo a média atual' : 'Semana encerrada'}</div>
        </div>
        <div className="card">
          <h3>Média das {TREND_WEEKS - 1} semanas anteriores</h3>
          <div className="kpi-value">{view.trendAvg > 0 ? brl(view.trendAvg) : '—'}</div>
          <div className="kpi-sub">
            {vsAvg === null ? 'Sem histórico' : `Esta semana: ${vsAvg >= 0 ? '▲' : '▼'} ${Math.abs(vsAvg).toFixed(0)}% ${vsAvg >= 0 ? 'acima' : 'abaixo'}`}
          </div>
        </div>
        <div className="card">
          <h3>Maior gasto</h3>
          <div className="kpi-value">{view.biggest ? brl(Number(view.biggest.amount)) : '—'}</div>
          <div className="kpi-sub">
            {view.biggest ? `${view.biggest.categories?.icon ?? '❓'} ${view.biggest.description || view.biggest.categories?.name || 'Sem descrição'}` : 'Nenhum lançamento'}
          </div>
        </div>
      </div>

      <div className="grid2" style={{ opacity: loading ? 0.5 : 1 }}>
        <div className="card">
          <h3>Gastos por dia da semana</h3>
          <div className="bars week">
            {view.daily.map((v, i) => {
              const d = addDays(monday, i)
              const isToday = isCurrentWeek && i === todayIdx
              return (
                <div key={i} className="bar-col" title={`${short(d)}: ${brl(v)}`}>
                  <span className="bar-value">{v > 0 ? brl(v) : ''}</span>
                  <div className={`bar${isToday ? ' today' : ''}`} style={{ height: `${(v / maxDaily) * 80}%` }} />
                  <span className="bar-label">{WEEKDAYS[i]} {pad(d.getDate())}</span>
                </div>
              )
            })}
          </div>
        </div>
        <CategoryCard cats={view.cats} catFilter={catFilter} setCatFilter={setCatFilter} />
      </div>

      <div className="card" style={{ marginBottom: '1rem', opacity: loading ? 0.5 : 1 }}>
        <h3>Últimas {TREND_WEEKS} semanas <span className="muted" style={{ textTransform: 'none' }}>(clique para abrir a semana)</span></h3>
        <div className="bars trend">
          {view.weekTotals.map((w) => (
            <div key={w.key} className="bar-col clickable" title={`${short(w.start)} – ${short(addDays(w.start, 6))}: ${brl(w.total)}`} onClick={() => goTo(w.start)}>
              <span className="bar-value">{w.total > 0 ? brl(w.total) : ''}</span>
              <div className={`bar${w.key === mondayKey ? ' selected' : ''}`} style={{ height: `${(w.total / maxTrend) * 78}%` }} />
              <span className="bar-label">{short(w.start)}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ opacity: loading ? 0.5 : 1 }}>
        <ExpenseTable expenses={view.week} cats={view.cats} catFilter={catFilter} setCatFilter={setCatFilter} showWeekday />
      </div>
    </div>
  )
}
