import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { toast } from './Toast'

type Category = { id: string; name: string; icon: string }

type OfflineExpense = {
  amount: number
  description: string
  category_id: string
  expense_date: string
}

export default function Home() {
  const [categories, setCategories] = useState<Category[]>([])
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  const getToday = () => new Date().toISOString().split('T')[0]

  const [expenseDate, setExpenseDate] = useState(getToday())
  const [showDatePicker, setShowDatePicker] = useState(false)

  useEffect(() => {
    fetchCategories()

    const handleOnline = () => {
      setIsOnline(true)
      syncOfflineExpenses()
    }
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    if (navigator.onLine) syncOfflineExpenses()

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  async function fetchCategories() {
    const { data } = await supabase.from('categories').select('*').order('name')
    if (data) setCategories(data)
  }

  async function syncOfflineExpenses() {
    const pendentes = localStorage.getItem('offline_expenses')
    if (!pendentes) return

    const expensesToSync: OfflineExpense[] = JSON.parse(pendentes)
    if (expensesToSync.length === 0) return

    console.log(`Sincronizando ${expensesToSync.length} despesas pendentes...`)

    const { error } = await supabase.from('expenses').insert(expensesToSync)

    if (!error) {
      localStorage.removeItem('offline_expenses')
      toast(`Sincronizamos ${expensesToSync.length} gastos que estavam pendentes!`)
    }
  }

  const handleSaveExpense = async (categoryId: string) => {
    if (!amount || isNaN(Number(amount))) {
      toast('Por favor, insira um valor válido.', 'error')
      return
    }

    setLoading(true)

    const newExpense = {
      amount: parseFloat(amount),
      description: description,
      category_id: categoryId,
      expense_date: expenseDate
    }

    if (isOnline) {
      const { error } = await supabase.from('expenses').insert([newExpense])
      if (error) toast('Erro ao salvar: ' + error.message, 'error')
      else toast('Gasto salvo com sucesso!')
    } else {
      const pendentes = localStorage.getItem('offline_expenses')
      const queue: OfflineExpense[] = pendentes ? JSON.parse(pendentes) : []
      queue.push(newExpense)
      localStorage.setItem('offline_expenses', JSON.stringify(queue))

      toast('Sem internet! Gasto salvo offline. Sincronizaremos quando o sinal voltar.')
    }

    setAmount('')
    setDescription('')
    setExpenseDate(getToday())
    setShowDatePicker(false)
    setLoading(false)
  }

  return (
    <div style={{ maxWidth: '400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

      {!isOnline && (
        <div style={{ padding: '0.8rem', borderRadius: '8px', textAlign: 'center', fontWeight: 'bold' }}>
          Você está Offline. Os gastos serão salvos no celular.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
        <input
          type="number"
          step="0.01"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          style={{ fontSize: '2.5rem', padding: '0.75rem', textAlign: 'center', borderRadius: '8px' }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
        <input
          type="text"
          placeholder="Descrição (opcional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          style={{ padding: '0.8rem', borderRadius: '8px', fontSize: '1rem' }}
        />
      </div>

      {/* Botão de Data Retroativa e Input */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
        <button
          type="button"
          onClick={() => setShowDatePicker(!showDatePicker)}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            textAlign: 'left',
            padding: '0.5rem 0',
            fontSize: '0.9rem',
            cursor: 'pointer',
            display: 'inline-flex',
            width: 'fit-content'
          }}
        >
          {showDatePicker ? '▼ Ocultar data' : '▶ Lançar com data retroativa'}
        </button>
        {showDatePicker && (
          <input
            type="date"
            value={expenseDate}
            max={getToday()}
            onChange={(e) => setExpenseDate(e.target.value)}
            style={{
              padding: '0.8rem',
              borderRadius: '8px',
              fontSize: '1rem',
              backgroundColor: 'var(--surface-color)',
              color: 'var(--text-main)',
              border: '1px solid var(--border-color)',
              colorScheme: 'dark'
            }}
          />
        )}
      </div>

      <div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
          {categories.map((cat) => (
            <button
              key={cat.id}
              disabled={loading}
              onClick={() => handleSaveExpense(cat.id)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '1rem', borderRadius: '12px', cursor: 'pointer'
              }}
            >
              <span style={{ fontSize: '2rem' }}>{cat.icon}</span>
              <span style={{ fontSize: '0.65rem', marginTop: '0.5rem', textAlign: 'center' }}>{cat.name}</span>
            </button>
          ))}
        </div>
      </div>

    </div>
  )
}