import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

type Expense = {
  amount: number
  categories: {
    name: string
    icon: string
  } | null
}

type GroupedExpense = {
  name: string
  icon: string
  total: number
}

export default function Relatorio() {
  const [groupedExpenses, setGroupedExpenses] = useState<GroupedExpense[]>([])
  const [totalWeek, setTotalWeek] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchWeeklyExpenses() {
      setLoading(true)

      const hoje = new Date()
      const diaDaSemana = hoje.getDay()

      const diffSegunda = hoje.getDate() - diaDaSemana + (diaDaSemana === 0 ? -6 : 1)

      const inicioSemana = new Date(hoje.setDate(diffSegunda))
      inicioSemana.setHours(0, 0, 0, 0)

      const fimSemana = new Date(inicioSemana)
      fimSemana.setDate(inicioSemana.getDate() + 6)
      fimSemana.setHours(23, 59, 59, 999)

      const startIso = inicioSemana.toISOString()
      const endIso = fimSemana.toISOString()

      const { data, error } = await supabase
        .from('expenses')
        .select('amount, categories(name, icon)')
        .gte('created_at', startIso)
        .lte('created_at', endIso)

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
            resumo[catName] = { name: catName, icon: catIcon, total: 0 }
          }
          resumo[catName].total += valor
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
    if (total > 2000) return 'var(--danger-color)'
    if (total > 1500) return '#fbbf24'
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
          <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            {groupedExpenses.map((item, index) => (
              <li key={index} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem',
                borderRadius: '8px', border: '1px solid var(--text-muted)'
              }}>
                <span style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>{item.icon}</span>
                  <span style={{ fontSize: '1rem' }}>{item.name}</span>
                </span>
                <strong style={{ fontSize: '1.2rem' }}>
                  R$ {item.total.toFixed(2).replace('.', ',')}
                </strong>
              </li>
            ))}
          </ul>
        )}
      </div>

    </div>
  )
}