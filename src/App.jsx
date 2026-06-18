import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AuthGuard from './components/AuthGuard'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Messes from './pages/Messes'
import Casuels from './pages/Casuels'
import Dons from './pages/Dons'
import Annonces from './pages/Annonces'
import Actualites from './pages/Actualites'
import SaintJour from './pages/SaintJour'
import TexteJour from './pages/TexteJour'
import Podcasts from './pages/Podcasts'
import Carrousel from './pages/Carrousel'
import Utilisateurs from './pages/Utilisateurs'
import Parametres from './pages/Parametres'
import Intentions from './pages/Intentions'
import DenierCulte from './pages/DenierCulte'
import Facturation from './pages/Facturation'
import Contact from './pages/Contact'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Route publique — accessible sans être connecté */}
        <Route path="login" element={<Login />} />

        {/* Routes protégées — redirige vers /login si pas de session */}
        <Route element={<AuthGuard />}>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="messes" element={<Messes />} />
            <Route path="casuels" element={<Casuels />} />
            <Route path="dons" element={<Dons />} />
            <Route path="annonces" element={<Annonces />} />
            <Route path="actualites" element={<Actualites />} />
            <Route path="saint-jour" element={<SaintJour />} />
            <Route path="texte-jour" element={<TexteJour />} />
            <Route path="podcasts" element={<Podcasts />} />
            <Route path="carrousel" element={<Carrousel />} />
            <Route path="intentions" element={<Intentions />} />
            <Route path="denier-culte" element={<DenierCulte />} />
            <Route path="facturation" element={<Facturation />} />
            <Route path="utilisateurs" element={<Utilisateurs />} />
            <Route path="contact" element={<Contact />} />
            <Route path="parametres" element={<Parametres />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  )
}
