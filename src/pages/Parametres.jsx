import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { supabase, q } from '../lib/supabase'
import Toast from '../components/Toast'
import { Save, Church, DollarSign, Shield, FileText } from 'lucide-react'

const SECTIONS = [
  { key: 'paroisse', label: 'Informations paroisse', icon: Church },
  { key: 'tarifs', label: 'Tarifs fixes', icon: DollarSign },
  { key: 'admins', label: 'Administrateurs', icon: Shield },
  { key: 'documents', label: 'Documents légaux', icon: FileText },
]

export default function Parametres() {
  const [activeSection, setActiveSection] = useState('paroisse')
  const [config, setConfig] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)
  const [admins, setAdmins] = useState([])
  const [newAdminEmail, setNewAdminEmail] = useState('')
  const [addingAdmin, setAddingAdmin] = useState(false)

  const showToast = (msg, type = 'success') => setToast({ msg, type })

  const { register: regParoisse, handleSubmit: hsParoisse, reset: resetParoisse } = useForm()
  const { register: regTarifs, handleSubmit: hsTarifs, reset: resetTarifs } = useForm()
  const { register: regDocs, handleSubmit: hsDocs, reset: resetDocs } = useForm()

  useEffect(() => { loadConfig() }, [])

  const loadConfig = async () => {
    setLoading(true)
    try {
      const { data } = await supabase.from('app_config').select('*')
      const configMap = {}
      ;(data || []).forEach(item => { configMap[item.cle] = item.valeur })
      setConfig(configMap)

      resetParoisse({
        nom_paroisse: configMap.nom_paroisse || '',
        adresse: configMap.adresse || '',
        telephone: configMap.telephone || '',
        email: configMap.email || '',
        description: configMap.description || '',
        facebook: configMap.facebook || '',
        whatsapp: configMap.whatsapp || '',
        horaires_bureau: configMap.horaires_bureau || '',
      })

      resetTarifs({
        montant_messe_intention: configMap.montant_messe_intention || '',
        montant_messe_action_grace: configMap.montant_messe_action_grace || '',
        montant_messe_defunt: configMap.montant_messe_defunt || '',
        taux_frais_mobile_money: configMap.taux_frais_mobile_money || '',
        don_minimum: configMap.don_minimum || '',
      })

      resetDocs({
        politique_confidentialite: configMap.politique_confidentialite || '',
        conditions_utilisation: configMap.conditions_utilisation || '',
        mentions_legales: configMap.mentions_legales || '',
      })

      // Charger admins
      const { data: adminData } = await supabase.from('profiles').select('id, nom, email').eq('role', 'admin')
      setAdmins(adminData || [])
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

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
      if (error || !data?.length) {
        showToast('Utilisateur introuvable avec cet email', 'error')
      } else {
        showToast('Administrateur ajouté')
        setNewAdminEmail('')
        loadConfig()
      }
    } catch {
      showToast('Erreur', 'error')
    }
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
  const SaveBtn = ({ loading }) => (
    <button
      type="submit"
      disabled={loading}
      className="flex items-center gap-2 text-white px-6 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50"
      style={{ backgroundColor: '#8B1A2E' }}
    >
      <Save size={16} /> {loading ? 'Enregistrement…' : 'Enregistrer'}
    </button>
  )

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Georgia, serif' }}>Paramètres</h2>

      <div className="flex gap-6">
        {/* Menu latéral */}
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

        {/* Contenu */}
        <div className="flex-1">
          {loading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />)}
            </div>
          ) : (
            <>
              {/* Paroisse */}
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

              {/* Tarifs */}
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

              {/* Admins */}
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
                        <button
                          onClick={() => removeAdmin(a.id)}
                          className="text-red-600 text-xs font-medium hover:underline"
                        >
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

              {/* Documents */}
              {activeSection === 'documents' && (
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h3 className="text-base font-bold text-gray-900 mb-4" style={{ fontFamily: 'Georgia, serif' }}>
                    Documents légaux
                  </h3>
                  <form onSubmit={hsDocs(saveSection)} className="space-y-4">
                    <div>
                      <label className={labelCls}>Politique de confidentialité</label>
                      <textarea {...regDocs('politique_confidentialite')} rows={8} className={`${inputCls} resize-none font-mono text-xs`} placeholder="Saisissez le texte de la politique de confidentialité…" />
                    </div>
                    <div>
                      <label className={labelCls}>Conditions d'utilisation</label>
                      <textarea {...regDocs('conditions_utilisation')} rows={8} className={`${inputCls} resize-none font-mono text-xs`} placeholder="Saisissez les conditions d'utilisation…" />
                    </div>
                    <div>
                      <label className={labelCls}>Mentions légales</label>
                      <textarea {...regDocs('mentions_legales')} rows={5} className={`${inputCls} resize-none font-mono text-xs`} placeholder="Saisissez les mentions légales…" />
                    </div>
                    <SaveBtn loading={saving} />
                  </form>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
