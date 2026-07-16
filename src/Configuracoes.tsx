import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { toast } from './Toast'

type Category = {
  id: string
  name: string
  icon: string
}

export default function Configuracoes() {
  const [categories, setCategories] = useState<Category[]>([])
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('')
  const [loading, setLoading] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [updatingPassword, setUpdatingPassword] = useState(false)

  useEffect(() => {
    fetchCategories()
  }, [])

  async function fetchCategories() {
    const { data, error } = await supabase.from('categories').select('*').order('name')
    if (data) setCategories(data)
    if (error) console.error('Erro ao buscar categorias:', error)
  }

  async function handleAddCategory(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)

    const { error } = await supabase.from('categories').insert([{ name, icon }])

    setLoading(false)
    if (error) {
      toast('Erro ao criar categoria: ' + error.message, 'error')
    } else {
      setName('')
      setIcon('')
      fetchCategories() // Atualiza a lista
    }
  }

  async function handleDeleteCategory(id: string) {
    if (!window.confirm('Tem certeza que deseja excluir esta categoria?')) return

    const { error } = await supabase.from('categories').delete().eq('id', id)
    if (error) {
      toast('Erro ao excluir: ' + error.message, 'error')
    } else {
      fetchCategories() // Atualiza a lista
    }
  }

  async function handleUpdatePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setUpdatingPassword(true)

    const { error } = await supabase.auth.updateUser({
      password: newPassword
    })

    setUpdatingPassword(false)

    if (error) {
      toast('Erro ao atualizar senha: ' + error.message, 'error')
    } else {
      setNewPassword('')
      toast('Senha atualizada com sucesso!')
    }
  }

  return (
    <div style={{ maxWidth: '400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>

      <form onSubmit={handleAddCategory} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem', borderRadius: '8px' }}>
        <h3>Nova Categoria</h3>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="text"
            placeholder=""
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            maxLength={2}
            required
            style={{ width: '60px', textAlign: 'center', fontSize: '1.5rem', borderRadius: '4px' }}
          />
          <input
            type="text"
            placeholder=""
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            style={{ flex: 1, padding: '0.5rem', borderRadius: '4px' }}
          />
        </div>

        <button type="submit" disabled={loading} style={{ padding: '0.5rem', cursor: 'pointer' }}>
          {loading ? 'Adicionando...' : 'Adicionar Categoria'}
        </button>
      </form>

      <div>
        <h3>Categorias Cadastradas</h3>
        <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {categories.map((cat) => (
            <li key={cat.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--text-muted)' }}>
              <span style={{ fontSize: '1.2rem' }}>{cat.icon} {cat.name}</span>
              <button
                onClick={() => handleDeleteCategory(cat.id)}
                style={{ background: 'var(--danger-color)', border: 'none', borderRadius: '4px', padding: '0.3rem 0.6rem', cursor: 'pointer' }}
              >
                Excluir
              </button>
            </li>
          ))}
          {categories.length === 0 && <p style={{ color: '#666' }}>Nenhuma categoria cadastrada.</p>}
        </ul>
      </div>

    </div>
  )
}