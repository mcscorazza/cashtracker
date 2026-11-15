import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import { AuthGate, CategoryCard, ExpenseTable, TopNav } from './shared'
import { brl, categoryStats, fetchRange, limitColor, pad, ymd } from './utils'
import type { Expense } from './utils'

export default function Dashboard() {
  return <AuthGate><DashboardContent /></AuthGate>
}

function DashboardContent() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [prevTotal, setPrevTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [catFilter, setCatFilter] = useState('')

  const daysInMonth = new Date(year, month + 1, 0).getDate()

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError('')
      try {
        const py = month === 0 ? year - 1 : year
        const pm = month === 0 ? 11 : month - 1
        const pDays = new Date(py, pm + 1, 0).getDate()
        const [cur, prev] = await Promise.all([
          fetchRange(ymd(year, month, 1), ymd(year, month, daysInMonth)),
          fetchRange(ymd(py, pm, 1), ymd(py, pm, pDays)),
        ])
        if (cancelled) return
        setExpenses(cur)
        setPrevTotal(prev.reduce((s, e) => s + Number(e.amount), 0))
      } catch (e) {
        if (!cancelled) setError((e as Error).message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [year, month, daysInMonth])

  const shiftMonth = (delta: number) => {
    const d = new Date(year, month + delta, 1)
    setYear(d.getFullYear())
    setMonth(d.getMonth())
    setCatFilter('')
  }

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth()
  const todayDay = now.getDate()

  const stats = useMemo(() => {
    const total = expenses.reduce((s, e) => s + Number(e.amount), 0)
    const elapsed = isCurrentMonth ? todayDay : daysInMonth
    const avg = elapsed ? total / elapsed : 0
    const projection = isCurrentMonth ? avg * daysInMonth : total

    const daily = Array.from({ length: daysInMonth }, () => 0)
    let biggest: Expense | null = null
    for (const e of expenses) {
      const v = Number(e.amount)
      daily[Number(e.expense_date.split('-')[2]) - 1] += v
      if (!biggest || v > Number(biggest.amount)) biggest = e
    }
    return { total, avg, projection, daily, catList: categoryStats(expenses), biggest }
  }, [expenses, isCurrentMonth, todayDay, daysInMonth])

  const maxDaily = Math.max(...stats.daily, 1)
  const monthLabel = new Date(year, month, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  const diff = prevTotal > 0 ? ((stats.total - prevTotal) / prevTotal) * 100 : null

  return (
    <div className="dash">
      <div className="dash-top">
        <div className="dash-left">
          <h1>💱 Corazza CashTracker</h1>
          <TopNav current="dash" />
        </div>
        <div className="dash-actions">
          <button onClick={() => shiftMonth(-1)}>←</button>
          <span className="dash-month">{monthLabel}</span>
          <button onClick={() => shiftMonth(1)} disabled={isCurrentMonth}>→</button>
          <button onClick={() => { setYear(now.getFullYear()); setMonth(now.getMonth()); setCatFilter('') }} disabled={isCurrentMonth}>Hoje</button>
          <button onClick={() => supabase.auth.signOut()}>Sair</button>
        </div>
      </div>

      {error && <div className="card" style={{ color: '#e05a5a', marginBottom: '1rem' }}>Erro ao carregar: {error}</div>}
      {loading && <p className="muted">Carregando...</p>}

      <div className="kpis" style={{ opacity: loading ? 0.5 : 1 }}>
        <div className="card">
          <h3>Total do mês</h3>
          <div className="kpi-value" style={{ color: limitColor(stats.total) }}>{brl(stats.total)}</div>
          <div className="kpi-sub">
            {diff === null ? 'Sem dados no mês anterior'
              : `${diff >= 0 ? '▲' : '▼'} ${Math.abs(diff).toFixed(0)}% vs mês anterior (${brl(prevTotal)})`}
          </div>
        </div>
        <div className="card">
          <h3>Média por dia</h3>
          <div className="kpi-value">{brl(stats.avg)}</div>
          <div className="kpi-sub">{isCurrentMonth ? `${todayDay} dias decorridos` : `${daysInMonth} dias`}</div>
        </div>
        <div className="card">
          <h3>{isCurrentMonth ? 'Projeção do mês' : 'Fechamento'}</h3>
          <div className="kpi-value" style={{ color: limitColor(stats.projection) }}>{brl(stats.projection)}</div>
          <div className="kpi-sub">{isCurrentMonth ? 'Mantendo a média atual' : 'Mês encerrado'}</div>
        </div>
        <div className="card">
          <h3>Maior gasto</h3>
          <div className="kpi-value">{stats.biggest ? brl(Number(stats.biggest.amount)) : '—'}</div>
          <div className="kpi-sub">
            {stats.biggest ? `${stats.biggest.categories?.icon ?? '❓'} ${stats.biggest.description || stats.biggest.categories?.name || 'Sem descrição'}` : 'Nenhum lançamento'}
          </div>
        </div>
        <div className="card">
          <h3>Lançamentos</h3>
          <div className="kpi-value">{expenses.length}</div>
          <div className="kpi-sub">{stats.catList.length} categorias</div>
        </div>
      </div>

      <div className="grid2" style={{ opacity: loading ? 0.5 : 1 }}>
        <div className="card">
          <h3>Gastos por dia</h3>
          <div className="bars">
            {stats.daily.map((v, i) => (
              <div key={i} className="bar-col" title={`${pad(i + 1)}/${pad(month + 1)}: ${brl(v)}`}>
                <div className={`bar${isCurrentMonth && i + 1 === todayDay ? ' today' : ''}`} style={{ height: `${(v / maxDaily) * 100}%` }} />
                <span className="bar-label">{i + 1}</span>
              </div>
            ))}
          </div>
        </div>
        <CategoryCard cats={stats.catList} catFilter={catFilter} setCatFilter={setCatFilter} />
      </div>

      <div style={{ opacity: loading ? 0.5 : 1 }}>
        <ExpenseTable expenses={expenses} cats={stats.catList} catFilter={catFilter} setCatFilter={setCatFilter} />
      </div>
    </div>
  )
}
