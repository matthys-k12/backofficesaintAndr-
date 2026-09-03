import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/AuthContext'
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
import Evenements from './pages/Evenements'
import DenierCulte from './pages/DenierCulte'
import Facturation from './pages/Facturation'
import Contact from './pages/Contact'
import Partage from './pages/Partage'
import Notifications from './pages/Notifications'
import SaviezVous from './pages/SaviezVous'
import QuizBiblique from './pages/QuizBiblique'

function PermissionRoute({ perm, adminOnly, children }) {
  const { isSuperAdmin, hasPermission, permissions } = useAuth()

  // Permissions encore en cours de chargement
  if (permissions === undefined && !isSuperAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <div
          className="w-6 h-6 rounded-full border-2 animate-spin"
          style={{ borderColor: '#8B1A2E', borderTopColor: 'transparent' }}
        />
      </div>
    )
  }

  if (adminOnly && !isSuperAdmin) return <Navigate to="/" replace />
  if (perm && !hasPermission(perm)) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="login" element={<Login />} />

          <Route path="s/app"       element={<Partage />} />
          <Route path="s/:type/:id" element={<Partage />} />
          <Route path="s/:type"     element={<Partage />} />

          <Route element={<AuthGuard />}>
            <Route element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="messes"       element={<PermissionRoute perm="messes">      <Messes />      </PermissionRoute>} />
              <Route path="casuels"      element={<PermissionRoute perm="casuels">     <Casuels />     </PermissionRoute>} />
              <Route path="dons"         element={<PermissionRoute perm="dons">        <Dons />        </PermissionRoute>} />
              <Route path="annonces"     element={<PermissionRoute perm="annonces">    <Annonces />    </PermissionRoute>} />
              <Route path="actualites"   element={<PermissionRoute perm="actualites">  <Actualites />  </PermissionRoute>} />
              <Route path="saint-jour"   element={<PermissionRoute perm="saint_jour">  <SaintJour />   </PermissionRoute>} />
              <Route path="texte-jour"   element={<PermissionRoute perm="texte_jour">  <TexteJour />   </PermissionRoute>} />
              <Route path="podcasts"     element={<PermissionRoute perm="podcasts">    <Podcasts />    </PermissionRoute>} />
              <Route path="carrousel"    element={<PermissionRoute perm="carrousel">   <Carrousel />   </PermissionRoute>} />
              <Route path="evenements"   element={<PermissionRoute perm="evenements">  <Evenements />  </PermissionRoute>} />
              <Route path="denier-culte" element={<PermissionRoute perm="denier_culte"><DenierCulte /></PermissionRoute>} />
              <Route path="facturation"  element={<PermissionRoute perm="facturation"> <Facturation /> </PermissionRoute>} />
              <Route path="utilisateurs" element={<PermissionRoute perm="utilisateurs"><Utilisateurs /></PermissionRoute>} />
              <Route path="contact"      element={<PermissionRoute perm="contact">     <Contact />     </PermissionRoute>} />
              <Route path="notifications"  element={<PermissionRoute perm="notifications"><Notifications /></PermissionRoute>} />
              <Route path="saviez-vous"   element={<PermissionRoute perm="annonces">   <SaviezVous />  </PermissionRoute>} />
              <Route path="quiz-biblique" element={<PermissionRoute perm="annonces">   <QuizBiblique /></PermissionRoute>} />
              <Route path="parametres"   element={<PermissionRoute adminOnly>          <Parametres />  </PermissionRoute>} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
