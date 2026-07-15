import { useState, useEffect } from 'react'
import { HashRouter, Routes, Route, Link } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'
import Home from './Home'
import Configuracoes from './Configuracoes'
import Relatorio from './Relatorio'

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
      <div style={{ padding: '4rem', maxWidth: '400px', margin: '0 auto' }}>
        <h2>Acesso Restrito</h2>
        <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }}
          style={{
            display: 'flex', flexDirection: 'column', gap: '1rem'
          }}>
          <input
            type="email"
            placeholder="Seu e-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ padding: '0.7rem', fontSize: '1.2rem' }}
            required
          />
          <input
            type="password"
            placeholder="Sua senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ padding: '0.7rem', fontSize: '1.2rem' }}
            required
          />
          <button type="submit" style={{ padding: '1.5rem' }}>Entrar</button>
        </form>
      </div>
    )
  }

  return (
    <HashRouter>
      <div style={{ padding: '1rem', maxWidth: '400px', margin: '0 auto' }}>

        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2>💱 Corazza CashTracker</h2>
          <button onClick={() => supabase.auth.signOut()} style={{ padding: '0.4rem' }}>Sair</button>
        </header>

        {/* Barra de Navegação Simples */}
        <nav style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid #ccc', paddingBottom: '1rem' }}>
          <Link to="/" style={{ textDecoration: 'none', color: '#007bff', fontWeight: 'bold' }}>Início</Link>
          <Link to="/relatorio" style={{ textDecoration: 'none', color: '#007bff', fontWeight: 'bold' }}>Relatório</Link>
          <Link to="/configuracoes" style={{ textDecoration: 'none', color: '#007bff', fontWeight: 'bold' }}>Configurações</Link>
        </nav>

        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/relatorio" element={<Relatorio />} />
          <Route path="/configuracoes" element={<Configuracoes />} />
        </Routes>

      </div>
    </HashRouter>
  )
}