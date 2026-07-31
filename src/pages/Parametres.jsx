import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { supabase, q } from '../lib/supabase'
import Toast from '../components/Toast'
import Modal from '../components/Modal'
import { Save, Church, DollarSign, Shield, FileText, Key, Plus, Trash2, Edit2, UserX, UserCheck } from 'lucide-react'

// ── Permissions disponibles ────────────────────────────────────────────
const PERM_GROUPS = {
  'Principal': [{ key: 'dashboard',     label: 'Tableau de bord' }],
  'Demandes':  [
    { key: 'messes',       label: 'Demandes de messe' },
    { key: 'casuels',      label: 'Casuels' },
    { key: 'dons',         label: 'Dons & campagnes' },
  ],
  'Contenu':   [
    { key: 'annonces',     label: 'Annonces' },
    { key: 'actualites',   label: 'Actualités' },
    { key: 'saint_jour',   label: 'Saint du jour' },
    { key: 'texte_jour',   label: 'Texte du jour' },
    { key: 'podcasts',     label: 'Podcasts' },
    { key: 'carrousel',    label: 'Carrousel' },
    { key: 'evenements',   label: 'Évènements' },
  ],
  'Finances':  [
    { key: 'denier_culte', label: 'Dénier du culte' },
    { key: 'facturation',  label: 'Revenus / Facturation' },
  ],
  'Gestion':   [
    { key: 'utilisateurs', label: 'Utilisateurs app' },
    { key: 'contact',      label: 'Messages & Suggestions' },
    { key: 'notifications', label: 'Notifications push' },
  ],
}

const SECTIONS = [
  { key: 'paroisse',  label: 'Informations paroisse', icon: Church   },
  { key: 'tarifs',    label: 'Tarifs fixes',           icon: DollarSign },
  { key: 'roles',     label: 'Rôles & Accès',          icon: Key      },
  { key: 'admins',    label: 'Administrateurs',         icon: Shield   },
  { key: 'documents', label: 'Documents légaux',        icon: FileText },
]

export default function Parametres() {
  const [activeSection, setActiveSection] = useState('paroisse')
  const [config,  setConfig]  = useState({})
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [toast,   setToast]   = useState(null)
  const [admins,  setAdmins]  = useState([])
  const [newAdminEmail, setNewAdminEmail] = useState('')
  const [addingAdmin,   setAddingAdmin]   = useState(false)

  // ── État section Rôles ─────────────────────────────────────────────
  const [roles,        setRoles]        = useState([])
  const [bUsers,       setBUsers]       = useState([])
  const [loadingRoles, setLoadingRoles] = useState(false)
  const [roleModal,    setRoleModal]    = useState(false)
  const [userModal,    setUserModal]    = useState(false)
  const [editingRole,  setEditingRole]  = useState(null)
  const [roleForm,     setRoleForm]     = useState({ nom: '', permissions: [] })
  const [userForm,     setUserForm]     = useState({ email: '', password: '', nom: '', role_id: '' })
  const [savingRole,   setSavingRole]   = useState(false)
  const [savingUser,   setSavingUser]   = useState(false)

  const showToast = (msg, type = 'success') => setToast({ msg, type })

  const { register: regParoisse, handleSubmit: hsParoisse, reset: resetParoisse } = useForm()
  const { register: regTarifs,   handleSubmit: hsTarifs,   reset: resetTarifs   } = useForm()
  const { register: regDocs,     handleSubmit: hsDocs,     reset: resetDocs     } = useForm()

  useEffect(() => { loadConfig() }, [])

  useEffect(() => {
    if (activeSection === 'roles') loadRoles()
  }, [activeSection])

  // ── Chargement config ──────────────────────────────────────────────
  const loadConfig = async () => {
    setLoading(true)
    try {
      const { data } = await supabase.from('app_config').select('*')
      const configMap = {}
      ;(data || []).forEach(item => { configMap[item.cle] = item.valeur })
      setConfig(configMap)

      resetParoisse({
        nom_paroisse:   configMap.nom_paroisse   || '',
        adresse:        configMap.adresse        || '',
        telephone:      configMap.telephone      || '',
        email:          configMap.email          || '',
        description:    configMap.description    || '',
        facebook:       configMap.facebook       || '',
        whatsapp:       configMap.whatsapp       || '',
        horaires_bureau: configMap.horaires_bureau || '',
      })

      resetTarifs({
        montant_messe_intention:    configMap.montant_messe_intention    || '',
        montant_messe_action_grace: configMap.montant_messe_action_grace || '',
        montant_messe_defunt:       configMap.montant_messe_defunt       || '',
        taux_frais_mobile_money:    configMap.taux_frais_mobile_money    || '',
        don_minimum:                configMap.don_minimum                || '',
      })

      resetDocs({
        politique_confidentialite: configMap.politique_confidentialite || '',
        conditions_utilisation:    configMap.conditions_utilisation    || '',
        mentions_legales:          configMap.mentions_legales          || '',
      })

      const { data: adminData } = await supabase.from('profiles').select('id, nom, email').eq('role', 'admin')
      setAdmins(adminData || [])
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  // ── Chargement rôles & utilisateurs backoffice ────────────────────
  const loadRoles = async () => {
    setLoadingRoles(true)

    const { data: rolesData } = await supabase.from('backoffice_roles').select('*').order('nom')
    const { data: usersData  } = await supabase
      .from('backoffice_user_roles')
      .select('*')
      .order('created_at', { ascending: false })

    const countByRole = {}
    ;(usersData || []).filter(u => u.is_active).forEach(u => {
      countByRole[u.role_id] = (countByRole[u.role_id] || 0) + 1
    })

    const enrichedRoles = (rolesData || []).map(r => ({ ...r, user_count: countByRole[r.id] || 0 }))
    setRoles(enrichedRoles)

    // Enrichir les utilisateurs avec le nom du rôle
    const rolesMap = Object.fromEntries((rolesData || []).map(r => [r.id, r.nom]))
    setBUsers((usersData || []).map(u => ({ ...u, role_nom: rolesMap[u.role_id] || '—' })))

    setLoadingRoles(false)
  }

  // ── CRUD rôles ─────────────────────────────────────────────────────
  const openCreateRole = () => {
    setEditingRole(null)
    setRoleForm({ nom: '', permissions: [] })
    setRoleModal(true)
  }

  const openEditRole = (role) => {
    setEditingRole(role)
    setRoleForm({ nom: role.nom, permissions: role.permissions || [] })
    setRoleModal(true)
  }

  const togglePerm = (key) => {
    setRoleForm(f => ({
      ...f,
      permissions: f.permissions.includes(key)
        ? f.permissions.filter(p => p !== key)
        : [...f.permissions, key],
    }))
  }

  const saveRole = async () => {
    if (!roleForm.nom.trim()) return
    setSavingRole(true)

    if (editingRole) {
      const { error } = await supabase.from('backoffice_roles').update({
        nom: roleForm.nom.trim(),
        permissions: roleForm.permissions,
      }).eq('id', editingRole.id)
      if (error) { showToast('Erreur lors de la mise à jour', 'error') }
      else        { showToast('Rôle mis à jour') }
    } else {
      const { error } = await supabase.from('backoffice_roles').insert({
        nom: roleForm.nom.trim(),
        permissions: roleForm.permissions,
      })
      if (error) { showToast(error.message.includes('unique') ? 'Ce nom de rôle existe déjà' : 'Erreur lors de la création', 'error') }
      else        { showToast('Rôle créé') }
    }

    setSavingRole(false)
    setRoleModal(false)
    setEditingRole(null)
    loadRoles()
  }

  const deleteRole = async (role) => {
    if (role.user_count > 0) {
      showToast(`Impossible : ${role.user_count} utilisateur(s) ont ce rôle`, 'error')
      return
    }
    if (!confirm(`Supprimer le rôle "${role.nom}" ?`)) return
    await supabase.from('backoffice_roles').delete().eq('id', role.id)
    showToast('Rôle supprimé')
    loadRoles()
  }

  // ── CRUD utilisateurs backoffice ───────────────────────────────────
  const createUser = async () => {
    if (!userForm.email || !userForm.password || !userForm.role_id) return
    setSavingUser(true)

    try {
      const { data, error } = await supabase.functions.invoke('create-backoffice-user', {
        body: {
          email:    userForm.email.trim(),
          password: userForm.password,
          nom:      userForm.nom.trim() || null,
          role_id:  userForm.role_id,
        },
      })

      if (error) {
        let msg = error.message
        try {
          // FunctionsHttpError : le corps JSON est dans error.context (Response)
          if (error.context?.json) {
            const body = await error.context.json()
            msg = body?.error || body?.message || msg
          } else if (error.context?.text) {
            // Fallback texte brut (ex : 404 HTML)
            const raw = await error.context.text()
            const status = error.context?.status
            msg = status === 404
              ? 'Edge Function introuvable — déployez-la avec : supabase functions deploy create-backoffice-user'
              : raw.slice(0, 200) || msg
          }
        } catch {
          // context non lisible, garder le message générique
        }
        showToast(msg, 'error')
      } else if (data?.error) {
        showToast(data.error, 'error')
      } else {
        showToast('Accès créé avec succès')
        setUserModal(false)
        setUserForm({ email: '', password: '', nom: '', role_id: '' })
        loadRoles()
      }
    } catch (e) {
      showToast(e?.message || 'Erreur inattendue', 'error')
    }

    setSavingUser(false)
  }

  const toggleUserAccess = async (user) => {
    const action = user.is_active ? 'révoquer' : 'réactiver'
    if (!confirm(`Voulez-vous ${action} l'accès de ${user.email} ?`)) return
    await supabase.from('backoffice_user_roles')
      .update({ is_active: !user.is_active })
      .eq('user_id', user.user_id)
    showToast(user.is_active ? 'Accès révoqué' : 'Accès réactivé')
    loadRoles()
  }

  // ── Sauvegarde config ──────────────────────────────────────────────
  const saveSection = async (sectionData) => {
    setSaving(true)
    try {
      const entries = Object.entries(sectionData)
      for (const [cle, valeur] of entries) {
        await supabase.from('app_config').upsert({ cle, valeur: valeur?.toString() || '' }, { onConflict: 'cle' })
      }
      showToast('Paramètres enregistrés')
    } catch {
      showToast('Erreur lors de l\'enregistrement', 'error')
    }
    setSaving(false)
  }

  const addAdmin = async () => {
    if (!newAdminEmail) return
    setAddingAdmin(true)
    try {
      const { data, error } = await supabase.from('profiles').update({ role: 'admin' }).eq('email', newAdminEmail).select()
      if (error || !data?.length) { showToast('Utilisateur introuvable avec cet email', 'error') }
      else { showToast('Administrateur ajouté'); setNewAdminEmail(''); loadConfig() }
    } catch { showToast('Erreur', 'error') }
    setAddingAdmin(false)
  }

  const removeAdmin = async (userId) => {
    if (!confirm('Retirer les droits admin de cet utilisateur ?')) return
    await supabase.from('profiles').update({ role: 'user' }).eq('id', userId)
    showToast('Droits admin retirés')
    loadConfig()
  }

  const inputCls = "w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-red-800"
  const labelCls = "block text-sm font-medium text-gray-700 mb-1"
  const SaveBtn = ({ loading: l }) => (
    <button
      type="submit"
      disabled={l}
      className="flex items-center gap-2 text-white px-6 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50"
      style={{ backgroundColor: '#8B1A2E' }}
    >
      <Save size={16} /> {l ? 'Enregistrement…' : 'Enregistrer'}
    </button>
  )

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Georgia, serif' }}>Paramètres</h2>

      <div className="flex gap-6">
        {/* ── Menu latéral ─────────────────────────────────── */}
        <div className="w-48 shrink-0">
          <nav className="space-y-1">
            {SECTIONS.map(s => (
              <button
                key={s.key}
                onClick={() => setActiveSection(s.key)}
                className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg text-sm transition-colors text-left"
                style={{
                  backgroundColor: activeSection === s.key ? '#1A237E' : 'transparent',
                  color: activeSection === s.key ? 'white' : '#4b5563',
                }}
              >
                <s.icon size={16} />
                <span>{s.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* ── Contenu ──────────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          {loading && activeSection !== 'roles' ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />)}
            </div>
          ) : (
            <>
              {/* ── Paroisse ───────────────────────────────── */}
              {activeSection === 'paroisse' && (
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h3 className="text-base font-bold text-gray-900 mb-4" style={{ fontFamily: 'Georgia, serif' }}>
                    Informations de la paroisse
                  </h3>
                  <form onSubmit={hsParoisse(saveSection)} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={labelCls}>Nom de la paroisse</label>
                        <input {...regParoisse('nom_paroisse')} className={inputCls} />
                      </div>
                      <div>
                        <label className={labelCls}>Email de contact</label>
                        <input type="email" {...regParoisse('email')} className={inputCls} />
                      </div>
                    </div>
                    <div>
                      <label className={labelCls}>Adresse</label>
                      <input {...regParoisse('adresse')} className={inputCls} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={labelCls}>Téléphone</label>
                        <input {...regParoisse('telephone')} className={inputCls} />
                      </div>
                      <div>
                        <label className={labelCls}>WhatsApp</label>
                        <input {...regParoisse('whatsapp')} className={inputCls} />
                      </div>
                    </div>
                    <div>
                      <label className={labelCls}>Page Facebook (URL)</label>
                      <input {...regParoisse('facebook')} type="url" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Description</label>
                      <textarea {...regParoisse('description')} rows={3} className={`${inputCls} resize-none`} />
                    </div>
                    <div>
                      <label className={labelCls}>Horaires du bureau paroissial</label>
                      <textarea {...regParoisse('horaires_bureau')} rows={2} className={`${inputCls} resize-none`} />
                    </div>
                    <SaveBtn loading={saving} />
                  </form>
                </div>
              )}

              {/* ── Tarifs ─────────────────────────────────── */}
              {activeSection === 'tarifs' && (
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h3 className="text-base font-bold text-gray-900 mb-4" style={{ fontFamily: 'Georgia, serif' }}>
                    Tarifs fixes
                  </h3>
                  <form onSubmit={hsTarifs(saveSection)} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={labelCls}>Messe d'intention (FCFA)</label>
                        <input type="number" {...regTarifs('montant_messe_intention')} className={inputCls} />
                      </div>
                      <div>
                        <label className={labelCls}>Messe action de grâce (FCFA)</label>
                        <input type="number" {...regTarifs('montant_messe_action_grace')} className={inputCls} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={labelCls}>Messe défunt (FCFA)</label>
                        <input type="number" {...regTarifs('montant_messe_defunt')} className={inputCls} />
                      </div>
                      <div>
                        <label className={labelCls}>Taux frais Mobile Money (%)</label>
                        <input type="number" step="0.01" {...regTarifs('taux_frais_mobile_money')} className={inputCls} />
                      </div>
                    </div>
                    <div>
                      <label className={labelCls}>Don minimum (FCFA)</label>
                      <input type="number" {...regTarifs('don_minimum')} className={inputCls} />
                    </div>
                    <SaveBtn loading={saving} />
                  </form>
                </div>
              )}

              {/* ── Rôles & Accès ──────────────────────────── */}
              {activeSection === 'roles' && (
                <div className="space-y-6">
                  {loadingRoles ? (
                    <div className="space-y-3">
                      {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}
                    </div>
                  ) : (
                    <>
                      {/* Rôles définis */}
                      <div className="bg-white rounded-xl border border-gray-200 p-6">
                        <div className="flex items-center justify-between mb-5">
                          <div>
                            <h3 className="text-base font-bold text-gray-900" style={{ fontFamily: 'Georgia, serif' }}>
                              Rôles définis
                            </h3>
                            <p className="text-xs text-gray-400 mt-0.5">Chaque rôle définit les pages accessibles</p>
                          </div>
                          <button
                            onClick={openCreateRole}
                            className="flex items-center gap-1.5 text-white px-4 py-2 rounded-lg text-sm font-medium"
                            style={{ backgroundColor: '#8B1A2E' }}
                          >
                            <Plus size={14} /> Créer un rôle
                          </button>
                        </div>

                        {roles.length === 0 ? (
                          <p className="text-sm text-gray-400">Aucun rôle créé. Commencez par créer un rôle.</p>
                        ) : (
                          <div className="space-y-3">
                            {roles.map(role => (
                              <div
                                key={role.id}
                                className="flex items-start justify-between gap-4 p-4 rounded-xl border border-gray-100"
                                style={{ backgroundColor: '#fafafa' }}
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className="text-sm font-bold text-gray-800">{role.nom}</span>
                                    <span
                                      className="px-2 py-0.5 rounded-full text-xs font-medium"
                                      style={{ backgroundColor: '#e8f0fe', color: '#1A237E' }}
                                    >
                                      {role.user_count} utilisateur{role.user_count !== 1 ? 's' : ''}
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap gap-1.5">
                                    {(role.permissions || []).length === 0 ? (
                                      <span className="text-xs text-gray-400 italic">Aucune permission</span>
                                    ) : (role.permissions || []).map(p => {
                                      const label = Object.values(PERM_GROUPS).flat().find(x => x.key === p)?.label || p
                                      return (
                                        <span
                                          key={p}
                                          className="px-2 py-0.5 rounded-md text-xs font-medium"
                                          style={{ backgroundColor: '#fef3c7', color: '#92400e' }}
                                        >
                                          {label}
                                        </span>
                                      )
                                    })}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  <button
                                    onClick={() => openEditRole(role)}
                                    className="p-2 rounded-lg hover:bg-gray-200 text-gray-500 transition-colors"
                                    title="Modifier"
                                  >
                                    <Edit2 size={14} />
                                  </button>
                                  <button
                                    onClick={() => deleteRole(role)}
                                    className="p-2 rounded-lg hover:bg-red-50 text-red-400 transition-colors"
                                    title="Supprimer"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Utilisateurs backoffice */}
                      <div className="bg-white rounded-xl border border-gray-200 p-6">
                        <div className="flex items-center justify-between mb-5">
                          <div>
                            <h3 className="text-base font-bold text-gray-900" style={{ fontFamily: 'Georgia, serif' }}>
                              Accès backoffice
                            </h3>
                            <p className="text-xs text-gray-400 mt-0.5">Utilisateurs avec accès limité au backoffice</p>
                          </div>
                          <button
                            onClick={() => {
                              setUserForm({ email: '', password: '', nom: '', role_id: roles[0]?.id || '' })
                              setUserModal(true)
                            }}
                            disabled={roles.length === 0}
                            className="flex items-center gap-1.5 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40"
                            style={{ backgroundColor: '#1A237E' }}
                          >
                            <Plus size={14} /> Ajouter un accès
                          </button>
                        </div>

                        {bUsers.length === 0 ? (
                          <p className="text-sm text-gray-400">Aucun accès backoffice créé.</p>
                        ) : (
                          <div className="divide-y divide-gray-100">
                            {bUsers.map(user => (
                              <div key={user.user_id} className="flex items-center justify-between py-3 gap-4">
                                <div className="flex items-center gap-3">
                                  <div
                                    className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                                    style={{ backgroundColor: user.is_active ? '#1A237E' : '#9ca3af' }}
                                  >
                                    {(user.nom || user.email).slice(0, 2).toUpperCase()}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <p className="text-sm font-semibold text-gray-800">
                                        {user.nom || '—'}
                                      </p>
                                      <span
                                        className="px-2 py-0.5 rounded-full text-xs font-medium"
                                        style={{
                                          backgroundColor: user.is_active ? '#dcfce7' : '#fee2e2',
                                          color: user.is_active ? '#166534' : '#991b1b',
                                        }}
                                      >
                                        {user.is_active ? user.role_nom : 'Révoqué'}
                                      </span>
                                    </div>
                                    <p className="text-xs text-gray-400">{user.email}</p>
                                  </div>
                                </div>
                                <button
                                  onClick={() => toggleUserAccess(user)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                                  style={user.is_active
                                    ? { backgroundColor: '#fee2e2', color: '#991b1b' }
                                    : { backgroundColor: '#dcfce7', color: '#166534' }}
                                >
                                  {user.is_active ? <><UserX size={12} /> Révoquer</> : <><UserCheck size={12} /> Réactiver</>}
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ── Administrateurs ────────────────────────── */}
              {activeSection === 'admins' && (
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h3 className="text-base font-bold text-gray-900 mb-4" style={{ fontFamily: 'Georgia, serif' }}>
                    Administrateurs
                  </h3>
                  <div className="space-y-3 mb-6">
                    {admins.length === 0 ? (
                      <p className="text-gray-400 text-sm">Aucun administrateur trouvé</p>
                    ) : admins.map(a => (
                      <div key={a.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="text-sm font-medium text-gray-800">{a.nom || '—'}</p>
                          <p className="text-xs text-gray-500">{a.email}</p>
                        </div>
                        <button onClick={() => removeAdmin(a.id)} className="text-red-600 text-xs font-medium hover:underline">
                          Retirer admin
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-gray-100 pt-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Ajouter un administrateur</h4>
                    <p className="text-xs text-gray-500 mb-3">L'utilisateur doit déjà avoir un compte dans l'app.</p>
                    <div className="flex gap-2">
                      <input
                        type="email"
                        value={newAdminEmail}
                        onChange={e => setNewAdminEmail(e.target.value)}
                        placeholder="Email de l'utilisateur"
                        className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none"
                      />
                      <button
                        onClick={addAdmin}
                        disabled={addingAdmin || !newAdminEmail}
                        className="text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                        style={{ backgroundColor: '#8B1A2E' }}
                      >
                        {addingAdmin ? '…' : 'Ajouter'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Documents ──────────────────────────────── */}
              {activeSection === 'documents' && (
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h3 className="text-base font-bold text-gray-900 mb-4" style={{ fontFamily: 'Georgia, serif' }}>
                    Documents légaux
                  </h3>
                  <form onSubmit={hsDocs(saveSection)} className="space-y-4">
                    <div>
                      <label className={labelCls}>Politique de confidentialité</label>
                      <textarea {...regDocs('politique_confidentialite')} rows={8} className={`${inputCls} resize-none font-mono text-xs`} />
                    </div>
                    <div>
                      <label className={labelCls}>Conditions d'utilisation</label>
                      <textarea {...regDocs('conditions_utilisation')} rows={8} className={`${inputCls} resize-none font-mono text-xs`} />
                    </div>
                    <div>
                      <label className={labelCls}>Mentions légales</label>
                      <textarea {...regDocs('mentions_legales')} rows={5} className={`${inputCls} resize-none font-mono text-xs`} />
                    </div>
                    <SaveBtn loading={saving} />
                  </form>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Modal : créer / modifier un rôle ──────────────────────── */}
      <Modal
        isOpen={roleModal}
        onClose={() => { setRoleModal(false); setEditingRole(null) }}
        title={editingRole ? `Modifier le rôle "${editingRole.nom}"` : 'Créer un rôle'}
        size="md"
      >
        <div className="space-y-5">
          <div>
            <label className={labelCls}>Nom du rôle</label>
            <input
              type="text"
              value={roleForm.nom}
              onChange={e => setRoleForm(f => ({ ...f, nom: e.target.value }))}
              placeholder="ex : Caissier, Sacristain, Chargé de contenu…"
              className={inputCls}
            />
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700 mb-3">Pages accessibles</p>
            <div className="space-y-4">
              {Object.entries(PERM_GROUPS).map(([group, perms]) => (
                <div key={group}>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">{group}</p>
                  <div className="grid grid-cols-2 gap-y-2 gap-x-4">
                    {perms.map(({ key, label }) => (
                      <label key={key} className="flex items-center gap-2 cursor-pointer group">
                        <div
                          onClick={() => togglePerm(key)}
                          className="w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors cursor-pointer"
                          style={{
                            borderColor: roleForm.permissions.includes(key) ? '#8B1A2E' : '#d1d5db',
                            backgroundColor: roleForm.permissions.includes(key) ? '#8B1A2E' : 'white',
                          }}
                        >
                          {roleForm.permissions.includes(key) && (
                            <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                              <path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </div>
                        <span
                          onClick={() => togglePerm(key)}
                          className="text-sm text-gray-700 cursor-pointer select-none"
                        >
                          {label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-gray-100">
            <span className="text-xs text-gray-400">
              {roleForm.permissions.length} permission{roleForm.permissions.length !== 1 ? 's' : ''} sélectionnée{roleForm.permissions.length !== 1 ? 's' : ''}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => { setRoleModal(false); setEditingRole(null) }}
                className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100"
              >
                Annuler
              </button>
              <button
                onClick={saveRole}
                disabled={savingRole || !roleForm.nom.trim()}
                className="px-5 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-40"
                style={{ backgroundColor: '#8B1A2E' }}
              >
                {savingRole ? 'Enregistrement…' : editingRole ? 'Mettre à jour' : 'Créer le rôle'}
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* ── Modal : créer un utilisateur backoffice ────────────────── */}
      <Modal
        isOpen={userModal}
        onClose={() => setUserModal(false)}
        title="Créer un accès backoffice"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Un compte sera créé avec ces identifiants. L'utilisateur pourra se connecter immédiatement.
          </p>

          <div>
            <label className={labelCls}>Nom <span className="text-gray-400">(optionnel)</span></label>
            <input
              type="text"
              value={userForm.nom}
              onChange={e => setUserForm(f => ({ ...f, nom: e.target.value }))}
              placeholder="ex : Jean Dupont"
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>Email</label>
            <input
              type="email"
              value={userForm.email}
              onChange={e => setUserForm(f => ({ ...f, email: e.target.value }))}
              placeholder="jean.dupont@example.com"
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>Mot de passe</label>
            <input
              type="password"
              value={userForm.password}
              onChange={e => setUserForm(f => ({ ...f, password: e.target.value }))}
              placeholder="Minimum 6 caractères"
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>Rôle</label>
            <select
              value={userForm.role_id}
              onChange={e => setUserForm(f => ({ ...f, role_id: e.target.value }))}
              className={inputCls}
            >
              <option value="">Choisir un rôle…</option>
              {roles.map(r => (
                <option key={r.id} value={r.id}>{r.nom}</option>
              ))}
            </select>
          </div>

          {userForm.role_id && (() => {
            const role = roles.find(r => r.id === userForm.role_id)
            if (!role || !role.permissions?.length) return null
            return (
              <div className="rounded-lg p-3" style={{ backgroundColor: '#f0f9ff', border: '1px solid #bae6fd' }}>
                <p className="text-xs font-semibold text-blue-700 mb-1.5">Accès inclus dans ce rôle :</p>
                <div className="flex flex-wrap gap-1">
                  {role.permissions.map(p => {
                    const label = Object.values(PERM_GROUPS).flat().find(x => x.key === p)?.label || p
                    return <span key={p} className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">{label}</span>
                  })}
                </div>
              </div>
            )
          })()}

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <button
              onClick={() => setUserModal(false)}
              className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100"
            >
              Annuler
            </button>
            <button
              onClick={createUser}
              disabled={savingUser || !userForm.email || !userForm.password || !userForm.role_id}
              className="px-5 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-40"
              style={{ backgroundColor: '#1A237E' }}
            >
              {savingUser ? 'Création…' : 'Créer l\'accès'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
