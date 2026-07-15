import { useState, useEffect } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) alert('Erro ao fazer login: ' + error.message)
  }

  if (loading) return <div>Carregando...</div>

  if (!session) {
    return (
      <div style={{ padding: '2rem', maxWidth: '400px', margin: '0 auto' }}>
        <h2>Acesso Restrito</h2>
        <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }} 
                                style={{ display: 'flex', flexDirection: 'column', 
                                gap: '1rem' }}>
          <input
            type="email"
            placeholder="Seu e-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Sua senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button type="submit">Entrar</button>
        </form>
      </div>
    )
  }

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Controle de Gastos</h1>
      <p>Logado como: {session.user.email}</p>
      <button onClick={() => supabase.auth.signOut()}>Sair</button>
    </div>
  )
}