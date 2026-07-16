import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './supabaseClient'

type Expense = {
  amount: number
  description: string
  expense_date: string
  categories: { name: string; icon: string } | null
}

type CategoryGroup = {
  icon: string
  subtotal: number
  items: Expense[]
}

export default function RelatorioMes() {
  const [groupedData, setGroupedData] = useState<Record<string, CategoryGroup>>({})
  const [totalMonth, setTotalMonth] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchMonthlyExpenses() {
      setLoading(true)

      // Lógica para pegar o primeiro e último dia do mês atual no formato YYYY-MM-DD
      const hoje = new Date()
      const ano = hoje.getFullYear()
      const mes = String(hoje.getMonth() + 1).padStart(2, '0')
      const ultimoDia = new Date(ano, hoje.getMonth() + 1, 0).getDate()

      const startOfMonth = `${ano}-${mes}-01`
      const endOfMonth = `${ano}-${mes}-${ultimoDia}`

      const { data, error } = await supabase
        .from('expenses')
        .select('amount, description, expense_date, categories(name, icon)')
        .gte('expense_date', startOfMonth)
        .lte('expense_date', endOfMonth)
        .order('expense_date', { ascending: false }) // Mais recentes primeiro

      if (error) {
        console.error('Erro ao buscar despesas do mês:', error)
        setLoading(false)
        return
      }

      const groups: Record<string, CategoryGroup> = {}
      let total = 0

      if (data) {
        const expenses = data as unknown as Expense[]

        expenses.forEach((item) => {
          const catName = item.categories?.name || 'Sem categoria'
          const catIcon = item.categories?.icon || '❓'
          const valor = Number(item.amount)

          if (!groups[catName]) {
            groups[catName] = { icon: catIcon, subtotal: 0, items: [] }
          }

          groups[catName].subtotal += valor
          groups[catName].items.push(item)
          total += valor
        })
      }

      setGroupedData(groups)
      setTotalMonth(total)
      setLoading(false)
    }

    fetchMonthlyExpenses()
  }, [])

  if (loading) return <p style={{ textAlign: 'center' }}>Carregando detalhamento...</p>

  // Lógica do semáforo que criamos anteriormente
  const getCorDoTotal = (total: number) => {
    if (total > 2000) return 'var(--danger-color)'
    if (total > 1500) return '#fbbf24'
    return 'var(--text-main)'
  }

  return (
    <div style={{ maxWidth: '400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '2rem' }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>Detalhamento do Mês</h3>
        <Link to="/relatorio" style={{ color: 'var(--accent-color)', textDecoration: 'none', fontSize: '0.9rem' }}>
          ← Voltar
        </Link>
      </div>

      <div style={{ background: 'var(--surface-color)', padding: '1.5rem', borderRadius: '12px', textAlign: 'center', border: '1px solid var(--accent-color)' }}>
        <h3 style={{ margin: 0, fontWeight: 'normal', fontSize: '1rem' }}>Total Acumulado</h3>
        <h1 style={{ margin: '0.5rem 0 0 0', fontSize: '2.5rem', color: getCorDoTotal(totalMonth), transition: 'color 0.3s' }}>
          R$ {totalMonth.toFixed(2).replace('.', ',')}
        </h1>
      </div>

      <div>
        {Object.keys(groupedData).length === 0 ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>Nenhum gasto registrado neste mês.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Transforma o objeto em array, ordena pelo maior subtotal e mapeia */}
            {Object.entries(groupedData)
              .sort(([, a], [, b]) => b.subtotal - a.subtotal)
              .map(([catName, group]) => (
                <div key={catName} style={{ background: 'var(--surface-color)', borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>

                  {/* Cabeçalho da Categoria com o Subtotal */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: '#2a2a2a' }}>
                    <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{group.icon} {catName}</span>
                    <strong style={{ fontSize: '1.1rem', color: 'var(--text-main)' }}>
                      R$ {group.subtotal.toFixed(2).replace('.', ',')}
                    </strong>
                  </div>

                  {/* Lista de gastos daquela categoria */}
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {group.items.map((item, index) => {
                      // Formata a data (ex: 2024-05-18 -> 18/05)
                      const [, mes, dia] = item.expense_date.split('-')
                      const dataFormatada = `${dia}/${mes}`

                      return (
                        <li key={index} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.8rem 1rem', borderTop: '1px solid var(--border-color)' }}>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>
                              {item.description || 'Sem descrição'}
                            </span>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                              {dataFormatada}
                            </span>
                          </div>
                          <span style={{ fontSize: '1rem' }}>
                            R$ {Number(item.amount).toFixed(2).replace('.', ',')}
                          </span>
                        </li>
                      )
                    })}
                  </ul>

                </div>
              ))}
          </div>
        )}
      </div>

    </div>
  )
}