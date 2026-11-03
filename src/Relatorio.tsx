import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './supabaseClient'

const DEFAULT_LIMIT_WARNING = 1500
const DEFAULT_LIMIT_DANGER = 2000

function getLimits() {
  const warning = Number(localStorage.getItem('ct_limit_warning')) || DEFAULT_LIMIT_WARNING
  const danger = Number(localStorage.getItem('ct_limit_danger')) || DEFAULT_LIMIT_DANGER
  return { warning, danger }
}

type Expense = {
  amount: number
  description: string
  expense_date: string
  categories: {
    name: string
    icon: string
  } | null
}

type GroupedExpense = {
  name: string
  icon: string
  total: number
  items: { description: string; expense_date: string; amount: number }[]
}

export default function Relatorio() {
  const [groupedExpenses, setGroupedExpenses] = useState<GroupedExpense[]>([])
  const [totalWeek, setTotalWeek] = useState(0)
  const [loading, setLoading] = useState(true)
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)

  useEffect(() => {
    async function fetchWeeklyExpenses() {
      setLoading(true)

      const hoje = new Date()
      const diaDaSemana = hoje.getDay()
      const diffSegunda = hoje.getDate() - diaDaSemana + (diaDaSemana === 0 ? -6 : 1)

      const inicioSemana = new Date(hoje)
      inicioSemana.setDate(diffSegunda)
      const fimSemana = new Date(inicioSemana)
      fimSemana.setDate(inicioSemana.getDate() + 6)

      const toDateStr = (d: Date) => d.toISOString().split('T')[0]
      const startStr = toDateStr(inicioSemana)
      const endStr = toDateStr(fimSemana)

      const { data, error } = await supabase
        .from('expenses')
        .select('amount, description, expense_date, categories(name, icon)')
        .gte('expense_date', startStr)
        .lte('expense_date', endStr)
        .order('expense_date', { ascending: false })

      if (error) {
        console.error('Erro ao buscar despesas:', error)
        setLoading(false)
        return
      }

      const resumo: Record<string, GroupedExpense> = {}
      let total = 0

      if (data) {
        const expenses = data as unknown as Expense[]
        expenses.forEach((item) => {
          const catName = item.categories?.name || 'Sem categoria'
          const catIcon = item.categories?.icon || '❓'
          const valor = Number(item.amount)
          if (!resumo[catName]) {
            resumo[catName] = { name: catName, icon: catIcon, total: 0, items: [] }
          }
          resumo[catName].total += valor
          resumo[catName].items.push({
            description: item.description,
            expense_date: item.expense_date,
            amount: valor,
          })
          total += valor
        })
      }

      const sortedExpenses = Object.values(resumo).sort((a, b) => b.total - a.total)

      setGroupedExpenses(sortedExpenses)
      setTotalWeek(total)
      setLoading(false)
    }

    fetchWeeklyExpenses()
  }, [])

  if (loading) return <p>Carregando relatório...</p>

  const getCorDoTotal = (total: number) => {
    const { warning, danger } = getLimits()
    if (total > danger) return 'var(--danger-color)'
    if (total > warning) return '#fbbf24'
    return 'var(--text-main)'
  }

  return (
    <div style={{ maxWidth: '400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      <div style={{ padding: '1.5rem', borderRadius: '12px', textAlign: 'center', background: 'var(--surface-color)', border: '1px solid var(--text-muted)' }}>
        <h3 style={{ margin: 0, fontWeight: 'normal', fontSize: '1rem' }}>Total da Semana</h3>
        <h1 style={{ margin: '0.5rem 0 0 0', fontSize: '2.5rem', color: getCorDoTotal(totalWeek), transition: 'color 0.3s' }}>
          R$ {totalWeek.toFixed(2).replace('.', ',')}
        </h1>
      </div>

      <div>
        <h3 style={{ marginBottom: '1rem' }}>Gastos por Categoria</h3>
        {groupedExpenses.length === 0 ? (
          <p style={{ color: '#666', textAlign: 'center' }}>Nenhum gasto registrado nesta semana.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            {groupedExpenses.map((item) => {
              const isOpen = expandedCategory === item.name
              return (
                <div key={item.name} style={{ borderRadius: '8px', border: '1px solid var(--text-muted)', overflow: 'hidden' }}>
                  <button
                    onClick={() => setExpandedCategory(isOpen ? null : item.name)}
                    style={{
                      width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '1rem', background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: 0
                    }}
                  >
                    <span style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span>{item.icon}</span>
                      <span style={{ fontSize: '1rem' }}>{item.name}</span>
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <strong style={{ fontSize: '1.2rem' }}>
                        R$ {item.total.toFixed(2).replace('.', ',')}
                      </strong>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{isOpen ? '▲' : '▼'}</span>
                    </span>
                  </button>

                  {isOpen && (
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                      {item.items.map((exp, i) => {
                        const [, mes, dia] = exp.expense_date.split('-')
                        return (
                          <li key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.7rem 1rem', borderTop: '1px solid var(--border-color)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontSize: '0.9rem' }}>{exp.description || 'Sem descrição'}</span>
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{dia}/{mes}</span>
                            </div>
                            <span style={{ fontSize: '0.95rem' }}>R$ {exp.amount.toFixed(2).replace('.', ',')}</span>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
      <Link
        to="/relatorio-mes"
        style={{
          display: 'block',
          textAlign: 'center',
          marginTop: '1rem',
          padding: '1rem',
          background: 'var(--surface-color)',
          color: 'var(--text-main)',
          textDecoration: 'none',
          borderRadius: '8px',
          border: '1px solid var(--border-color)'
        }}
      >
        Mês Completo
      </Link>
    </div>
  )
}