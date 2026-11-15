import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../supabaseClient'
import { brl, catName } from './utils'
import type { CatStat, Expense } from './utils'

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

export function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  if (loading) return <div style={{ padding: '2rem' }}>Carregando...</div>
  if (!session) return <Login />
  return <>{children}</>
}

export function TopNav({ current }: { current: 'dash' | 'weeks' }) {
  const link = (key: string, label: string) => (
    <a href={`../${key}/`} className={current === key ? 'active' : ''}>{label}</a>
  )
  return <nav className="dash-nav">{link('dash', 'Mensal')}{link('weeks', 'Semanal')}</nav>
}

type SortKey = 'expense_date' | 'category' | 'description' | 'amount'

export function ExpenseTable({
  expenses, cats, catFilter, setCatFilter, showWeekday = false,
}: {
  expenses: Expense[]
  cats: CatStat[]
  catFilter: string
  setCatFilter: (c: string) => void
  showWeekday?: boolean
}) {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('expense_date')
  const [sortAsc, setSortAsc] = useState(false)

  const q = search.trim().toLowerCase()
  const val = (e: Expense) =>
    sortKey === 'amount' ? Number(e.amount)
    : sortKey === 'category' ? catName(e)
    : sortKey === 'description' ? (e.description ?? '')
    : e.expense_date
  const rows = expenses
    .filter((e) => (!catFilter || catName(e) === catFilter)
      && (!q || `${e.description} ${catName(e)}`.toLowerCase().includes(q)))
    .sort((a, b) => {
      const x = val(a), y = val(b)
      const c = x < y ? -1 : x > y ? 1 : 0
      return sortAsc ? c : -c
    })
  const total = rows.reduce((s, e) => s + Number(e.amount), 0)

  const sortBy = (k: SortKey) => {
    if (k === sortKey) setSortAsc(!sortAsc)
    else { setSortKey(k); setSortAsc(k !== 'amount' && k !== 'expense_date') }
  }
  const arrow = (k: SortKey) => (k === sortKey ? (sortAsc ? ' ▲' : ' ▼') : '')

  return (
    <div className="card">
      <h3>Lançamentos</h3>
      <div className="filters">
        <input type="search" placeholder="Buscar descrição ou categoria..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
          <option value="">Todas as categorias</option>
          {cats.map((c) => <option key={c.name} value={c.name}>{c.icon} {c.name}</option>)}
        </select>
        {(search || catFilter) && (
          <button onClick={() => { setSearch(''); setCatFilter('') }} style={{ padding: '0.5rem 0.9rem', borderRadius: 8 }}>Limpar</button>
        )}
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
            const [y, m, d] = e.expense_date.split('-')
            const wd = showWeekday
              ? new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString('pt-BR', { weekday: 'short' }) + ' '
              : ''
            return (
              <tr key={e.id}>
                <td className="muted">{wd}{d}/{m}</td>
                <td>{e.categories?.icon ?? '❓'} {catName(e)}</td>
                <td>{e.description || <span className="muted">—</span>}</td>
                <td className="num">{brl(Number(e.amount))}</td>
              </tr>
            )
          })}
          {rows.length === 0 && <tr><td colSpan={4} className="empty">Nenhum lançamento.</td></tr>}
        </tbody>
        {rows.length > 0 && (
          <tfoot><tr><td colSpan={3}>Total ({rows.length})</td><td className="num">{brl(total)}</td></tr></tfoot>
        )}
      </table>
    </div>
  )
}

export function CategoryCard({
  cats, catFilter, setCatFilter,
}: { cats: CatStat[]; catFilter: string; setCatFilter: (c: string) => void }) {
  const max = cats[0]?.total || 1
  return (
    <div className="card">
      <h3>Por categoria <span className="muted" style={{ textTransform: 'none' }}>(clique para filtrar)</span></h3>
      {cats.length === 0 && <div className="empty">Sem gastos no período.</div>}
      {cats.map((c) => (
        <div key={c.name} className={`cat-row${catFilter === c.name ? ' active' : ''}`} onClick={() => setCatFilter(catFilter === c.name ? '' : c.name)}>
          <span className="cat-name">{c.icon} {c.name}</span>
          <span className="cat-track"><span className="cat-fill" style={{ display: 'block', width: `${(c.total / max) * 100}%` }} /></span>
          <span className="cat-val">{brl(c.total)}</span>
        </div>
      ))}
    </div>
  )
}
