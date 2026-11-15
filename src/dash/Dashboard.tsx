import { useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../supabaseClient'

const DEFAULT_LIMIT_WARNING = 1500
const DEFAULT_LIMIT_DANGER = 2000

type Expense = {
  id: string
  amount: number
  description: string
  expense_date: string
  categories: { name: string; icon: string } | null
}

type SortKey = 'expense_date' | 'category' | 'description' | 'amount'

const brl = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`

function limitColor(total: number) {
  const warning = Number(localStorage.getItem('ct_limit_warning')) || DEFAULT_LIMIT_WARNING
  const danger = Number(localStorage.getItem('ct_limit_danger')) || DEFAULT_LIMIT_DANGER
  if (total > danger) return '#e05a5a'
  if (total > warning) return '#fbbf24'
  return 'var(--text-main)'
}

async function fetchRange(start: string, end: string): Promise<Expense[]> {
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

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')

  return (
    <div style={{ padding: '4rem', maxWidth: 400, margin: '0 auto' }}>
      <h2>Acesso Restrito</h2>
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          const { error } = await supabase.auth.signInWithPassword({ email, password })
          if (error) setErr(error.message)
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
      >
        <input type="email" placeholder="Seu e-mail" value={email} onChange={(e) => setEmail(e.target.value)} style={{ padding: '0.7rem', fontSize: '1.1rem' }} required />
        <input type="password" placeholder="Sua senha" value={password} onChange={(e) => setPassword(e.target.value)} style={{ padding: '0.7rem', fontSize: '1.1rem' }} required />
        <button type="submit" style={{ padding: '1rem' }}>Entrar</button>
        {err && <span style={{ color: '#e05a5a' }}>{err}</span>}
      </form>
    </div>
  )
}

export default function Dashboard() {
  const [session, setSession] = useState<Session | null>(null)
  const [authLoading, setAuthLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  if (authLoading) return <div style={{ padding: '2rem' }}>Carregando...</div>
  if (!session) return <Login />
  return <DashboardContent />
}

function DashboardContent() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [prevTotal, setPrevTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('expense_date')
  const [sortAsc, setSortAsc] = useState(false)

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
    setSearch('')
  }

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth()
  const todayDay = now.getDate()

  const stats = useMemo(() => {
    const total = expenses.reduce((s, e) => s + Number(e.amount), 0)
    const elapsed = isCurrentMonth ? todayDay : daysInMonth
    const avg = elapsed ? total / elapsed : 0
    const projection = isCurrentMonth ? avg * daysInMonth : total

    const daily = Array.from({ length: daysInMonth }, () => 0)
    const cats: Record<string, { name: string; icon: string; total: number; count: number }> = {}
    let biggest: Expense | null = null
    for (const e of expenses) {
      const v = Number(e.amount)
      const day = Number(e.expense_date.split('-')[2])
      daily[day - 1] += v
      const name = e.categories?.name ?? 'Sem categoria'
      cats[name] ??= { name, icon: e.categories?.icon ?? '❓', total: 0, count: 0 }
      cats[name].total += v
      cats[name].count++
      if (!biggest || v > Number(biggest.amount)) biggest = e
    }
    const catList = Object.values(cats).sort((a, b) => b.total - a.total)
    return { total, avg, projection, daily, catList, biggest }
  }, [expenses, isCurrentMonth, todayDay, daysInMonth])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = expenses.filter((e) => {
      const name = e.categories?.name ?? 'Sem categoria'
      if (catFilter && name !== catFilter) return false
      if (q && !`${e.description} ${name}`.toLowerCase().includes(q)) return false
      return true
    })
    const val = (e: Expense) =>
      sortKey === 'amount' ? Number(e.amount)
      : sortKey === 'category' ? (e.categories?.name ?? 'Sem categoria')
      : sortKey === 'description' ? (e.description ?? '')
      : e.expense_date
    return [...list].sort((a, b) => {
      const x = val(a), y = val(b)
      const c = x < y ? -1 : x > y ? 1 : 0
      return sortAsc ? c : -c
    })
  }, [expenses, search, catFilter, sortKey, sortAsc])

  const rowsTotal = rows.reduce((s, e) => s + Number(e.amount), 0)
  const maxDaily = Math.max(...stats.daily, 1)
  const maxCat = stats.catList[0]?.total || 1

  const sortBy = (k: SortKey) => {
    if (k === sortKey) setSortAsc(!sortAsc)
    else { setSortKey(k); setSortAsc(k !== 'amount' && k !== 'expense_date') }
  }
  const arrow = (k: SortKey) => (k === sortKey ? (sortAsc ? ' ▲' : ' ▼') : '')

  const monthLabel = new Date(year, month, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  const diff = prevTotal > 0 ? ((stats.total - prevTotal) / prevTotal) * 100 : null

  return (
    <div className="dash">
      <div className="dash-top">
        <h1>💱 Corazza CashTracker · Dashboard</h1>
        <div className="dash-actions">
          <button onClick={() => shiftMonth(-1)}>←</button>
          <span className="dash-month">{monthLabel}</span>
          <button onClick={() => shiftMonth(1)} disabled={isCurrentMonth}>→</button>
          <button onClick={() => { setYear(now.getFullYear()); setMonth(now.getMonth()) }} disabled={isCurrentMonth}>Hoje</button>
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

        <div className="card">
          <h3>Por categoria <span className="muted" style={{ textTransform: 'none' }}>(clique para filtrar)</span></h3>
          {stats.catList.length === 0 && <div className="empty">Sem gastos neste mês.</div>}
          {stats.catList.map((c) => (
            <div key={c.name} className={`cat-row${catFilter === c.name ? ' active' : ''}`} onClick={() => setCatFilter(catFilter === c.name ? '' : c.name)}>
              <span className="cat-name">{c.icon} {c.name}</span>
              <span className="cat-track"><span className="cat-fill" style={{ display: 'block', width: `${(c.total / maxCat) * 100}%` }} /></span>
              <span className="cat-val">{brl(c.total)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ opacity: loading ? 0.5 : 1 }}>
        <h3>Lançamentos</h3>
        <div className="filters">
          <input type="search" placeholder="Buscar descrição ou categoria..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
            <option value="">Todas as categorias</option>
            {stats.catList.map((c) => <option key={c.name} value={c.name}>{c.icon} {c.name}</option>)}
          </select>
          {(search || catFilter) && <button onClick={() => { setSearch(''); setCatFilter('') }} style={{ padding: '0.5rem 0.9rem', borderRadius: 8 }}>Limpar</button>}
        </div>
        <table>
          <thead>
            <tr>
              <th onClick={() => sortBy('expense_date')}>Data{arrow('expense_date')}</th>
              <th onClick={() => sortBy('category')}>Categoria{arrow('category')}</th>
              <th onClick={() => sortBy('description')}>Descrição{arrow('description')}</th>
              <th className="num" onClick={() => sortBy('amount')}>Valor{arrow('amount')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => {
              const [, m, d] = e.expense_date.split('-')
              return (
                <tr key={e.id}>
                  <td className="muted">{d}/{m}</td>
                  <td>{e.categories?.icon ?? '❓'} {e.categories?.name ?? 'Sem categoria'}</td>
                  <td>{e.description || <span className="muted">—</span>}</td>
                  <td className="num">{brl(Number(e.amount))}</td>
                </tr>
              )
            })}
            {rows.length === 0 && <tr><td colSpan={4} className="empty">Nenhum lançamento.</td></tr>}
          </tbody>
          {rows.length > 0 && (
            <tfoot><tr><td colSpan={3}>Total ({rows.length})</td><td className="num">{brl(rowsTotal)}</td></tr></tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
