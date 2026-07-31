import { useState, useEffect, useCallback, useRef } from 'react'
import { Trash2, Wifi, WifiOff, Users, ImagePlus, Film, X, Eye, ExternalLink, Edit2 } from 'lucide-react'
import { supabase, q } from '../lib/supabase'
import DataTable from '../components/DataTable'
import Toast from '../components/Toast'
import Badge from '../components/Badge'
import Modal from '../components/Modal'
import { fmtDate, fmtMontant } from '../lib/helpers'

const BUCKET = 'evenements-media'

const FORM_INIT = {
  titre: '',
  description: '',
  image_file: null,
  image_preview: '',
  image_url_existing: '',
  video_file: null,
  video_name: '',
  video_url_existing: '',
  lieu: '',
  prix: 0,
  nombre_places: '',
  date_debut: '',
  date_fin: '',
  date_evenement: '',
  heure_evenement: '',
  est_actif: true,
}

async function uploadToStorage(file, folder) {
  const ext = file.name.split('.').pop().toLowerCase()
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false })
  if (error) throw error
  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return publicUrl
}

export default function Evenements() {
  const [form, setForm] = useState(FORM_INIT)
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)

  const [evenements, setEvenements] = useState([])
  const [loadingEvenements, setLoadingEvenements] = useState(true)
  const [filtreActif, setFiltreActif] = useState('tout')

  const [inscriptions, setInscriptions] = useState([])
  const [loadingInscriptions, setLoadingInscriptions] = useState(false)
  const [selectedEvenementId, setSelectedEvenementId] = useState('')

  const [toast, setToast] = useState(null)
  const [modalEvenement, setModalEvenement] = useState(null)
  const [modalInscrit, setModalInscrit] = useState(null)
  const imageInputRef = useRef(null)
  const videoInputRef = useRef(null)

  const showToast = (msg, type = 'success') => setToast({ msg, type })

  // ── Chargement des évènements ────────────────────────────────────────────
  const loadEvenements = useCallback(async () => {
    setLoadingEvenements(true)
    try {
      let query = supabase
        .from('evenements')
        .select('*')
        .order('created_at', { ascending: false })

      if (filtreActif === 'en_ligne') query = query.eq('est_actif', true)
      if (filtreActif === 'hors_ligne') query = query.eq('est_actif', false)

      const { data, error } = await query
      if (error) throw error
      setEvenements(data || [])
    } catch (err) {
      showToast('Erreur de chargement : ' + err.message, 'error')
    } finally {
      setLoadingEvenements(false)
    }
  }, [filtreActif])

  useEffect(() => { loadEvenements() }, [loadEvenements])

  // ── Chargement des inscrits ──────────────────────────────────────────────
  const loadInscriptions = useCallback(async () => {
    if (!selectedEvenementId) return
    setLoadingInscriptions(true)
    try {
      const { data, error } = await supabase
        .from('inscriptions_evenements')
        .select('*')
        .eq('evenement_id', selectedEvenementId)
        .order('created_at', { ascending: false })
      if (error) throw error
      const rows = data || []

      const uids = [...new Set(rows.map(r => r.user_id).filter(Boolean))]
      const profsMap = {}
      if (uids.length > 0) {
        const { data: profs } = await supabase.from('profiles').select('id, nom, telephone').in('id', uids)
        ;(profs || []).forEach(p => { profsMap[p.id] = p })
      }

      setInscriptions(rows.map(r => ({ ...r, profiles: profsMap[r.user_id] || null })))
    } catch (err) {
      showToast('Erreur de chargement des inscrits : ' + err.message, 'error')
    } finally {
      setLoadingInscriptions(false)
    }
  }, [selectedEvenementId])

  useEffect(() => { loadInscriptions() }, [loadInscriptions])

  const resetForm = () => {
    setForm(FORM_INIT)
    setEditId(null)
    if (imageInputRef.current) imageInputRef.current.value = ''
    if (videoInputRef.current) videoInputRef.current.value = ''
  }

  const openEdit = (ev) => {
    setForm({
      ...FORM_INIT,
      titre:              ev.titre || '',
      description:        ev.description || '',
      image_preview:      ev.image_url || '',
      image_url_existing: ev.image_url || '',
      video_name:         ev.video_url ? 'Vidéo existante' : '',
      video_url_existing: ev.video_url || '',
      lieu:               ev.lieu || '',
      prix:               ev.prix ?? 0,
      nombre_places:      ev.nombre_places ?? '',
      date_debut:         ev.date_debut || '',
      date_fin:           ev.date_fin || '',
      date_evenement:     ev.date_evenement || '',
      heure_evenement:    ev.heure_evenement || '',
      est_actif:          ev.est_actif ?? true,
    })
    setEditId(ev.id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // ── Soumission du formulaire ─────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!editId && !form.image_file) {
      showToast("L'image est obligatoire", 'error')
      return
    }
    setSaving(true)
    try {
      // Image : nouvelle upload OU url existante
      let image_url = form.image_url_existing || null
      if (form.image_file) image_url = await uploadToStorage(form.image_file, 'images')

      // Vidéo : nouvelle upload OU url existante
      let video_url = form.video_url_existing || null
      if (form.video_file) video_url = await uploadToStorage(form.video_file, 'videos')

      const payload = {
        titre:         form.titre.trim(),
        description:   form.description.trim(),
        image_url,
        video_url,
        lieu:          form.lieu.trim() || null,
        prix:          Number(form.prix) || 0,
        nombre_places: form.nombre_places !== '' ? Number(form.nombre_places) : null,
        date_debut:    form.date_debut || null,
        date_fin:      form.date_fin || null,
        date_evenement:  form.date_evenement || null,
        heure_evenement: form.heure_evenement || null,
        est_actif:     form.est_actif,
      }

      if (editId) {
        const { error } = await supabase.from('evenements').update(payload).eq('id', editId)
        if (error) throw error
        showToast('Évènement mis à jour')
      } else {
        const { error } = await supabase.from('evenements').insert(payload)
        if (error) throw error
        showToast('Évènement ajouté avec succès')
      }

      resetForm()
      loadEvenements()
    } catch (err) {
      showToast('Erreur : ' + err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const set = (field) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm(prev => ({ ...prev, [field]: val }))
  }

  const handleImageChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      showToast("L'image ne doit pas dépasser 5 MB", 'error')
      if (imageInputRef.current) imageInputRef.current.value = ''
      return
    }
    const preview = URL.createObjectURL(file)
    setForm(prev => ({ ...prev, image_file: file, image_preview: preview }))
  }

  const handleVideoChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 50 * 1024 * 1024) {
      showToast("La vidéo ne doit pas dépasser 50 MB", 'error')
      if (videoInputRef.current) videoInputRef.current.value = ''
      return
    }
    setForm(prev => ({ ...prev, video_file: file, video_name: file.name }))
  }

  const clearImage = () => {
    setForm(prev => ({ ...prev, image_file: null, image_preview: '', image_url_existing: '' }))
    if (imageInputRef.current) imageInputRef.current.value = ''
  }

  const clearVideo = () => {
    setForm(prev => ({ ...prev, video_file: null, video_name: '', video_url_existing: '' }))
    if (videoInputRef.current) videoInputRef.current.value = ''
  }

  // ── Toggle en ligne / hors ligne ─────────────────────────────────────────
  const toggleActif = async (ev) => {
    try {
      await q(supabase.from('evenements').update({ est_actif: !ev.est_actif }).eq('id', ev.id))
      showToast(ev.est_actif ? 'Évènement mis hors ligne' : 'Évènement mis en ligne')
      loadEvenements()
    } catch (err) {
      showToast('Erreur : ' + err.message, 'error')
    }
  }

  // ── Suppression ──────────────────────────────────────────────────────────
  const deleteEvenement = async (id) => {
    if (!confirm('Supprimer cet évènement ? Cette action est irréversible.')) return
    try {
      await q(supabase.from('evenements').delete().eq('id', id))
      showToast('Évènement supprimé')
      if (selectedEvenementId === id) setSelectedEvenementId('')
      loadEvenements()
    } catch (err) {
      showToast('Erreur : ' + err.message, 'error')
    }
  }

  // ── Colonnes table historique ────────────────────────────────────────────
  const colsEvenements = [
    {
      key: 'titre',
      label: 'Titre',
      render: (v) => <span className="font-medium text-gray-800">{v}</span>,
    },
    {
      key: 'date_evenement',
      label: "Date évènement",
      render: (v) => <span className="text-sm text-gray-700">{v ? fmtDate(v) : <span className="text-gray-400">—</span>}</span>,
    },
    {
      key: 'date_debut',
      label: 'Parution début',
      render: (v) => <span className="text-xs text-gray-500">{fmtDate(v)}</span>,
    },
    {
      key: 'date_fin',
      label: 'Parution fin',
      render: (v) => <span className="text-xs text-gray-500">{v ? fmtDate(v) : '—'}</span>,
    },
    {
      key: 'prix',
      label: 'Prix',
      render: (v) => (
        <span className="text-sm text-gray-700">
          {v === 0 || v === null ? 'Gratuit' : fmtMontant(v)}
        </span>
      ),
    },
    {
      key: 'est_actif',
      label: 'Statut',
      render: (v) => <Badge label={v ? 'En ligne' : 'Hors ligne'} value={v ? 'actif' : 'inactif'} />,
    },
  ]

  // ── Colonnes table inscrits ─────────────────────────────────────────────
  const colsInscritsFixed = [
    {
      key: 'created_at',
      label: "Date d'inscription",
      render: (v) => <span className="text-xs text-gray-500">{fmtDate(v)}</span>,
    },
    {
      key: 'profiles',
      label: 'Nom et Prénoms',
      render: (v) => (
        v?.nom
          ? <span className="text-sm font-medium text-gray-800">{v.nom}</span>
          : <span className="text-sm text-gray-400 italic">Anonyme</span>
      ),
    },
    {
      key: '_telephone',
      label: 'Numéro téléphone',
      render: (_, row) => (
        <span className="text-sm text-gray-600">{row.profiles?.telephone || '—'}</span>
      ),
    },
    {
      key: '_titre_ev',
      label: 'Titre Évènement',
      render: (_, row) => {
        const ev = evenements.find(e => String(e.id) === String(row.evenement_id))
        return <span className="text-sm text-gray-700">{ev?.titre || '—'}</span>
      },
    },
    {
      key: 'montant_paye',
      label: 'Montant payé',
      render: (v) => (
        <span className="text-sm text-gray-700">
          {v ? fmtMontant(v) : '—'}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-8">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {/* ── Section 1 — Formulaire d'ajout / modification ───────────────── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Georgia, serif' }}>
            {editId ? "Modifier l'évènement" : 'Ajouter un évènement'}
          </h2>
          {editId && (
            <button
              type="button"
              onClick={resetForm}
              className="text-sm text-gray-500 hover:text-gray-800 underline"
            >
              Annuler la modification
            </button>
          )}
        </div>

        <div className="bg-white rounded-xl shadow p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Titre + Description */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Titre *</label>
                <input
                  type="text"
                  required
                  value={form.titre}
                  onChange={set('titre')}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-gray-400"
                  placeholder="Nom de l'évènement"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lieu</label>
                <input
                  type="text"
                  value={form.lieu}
                  onChange={set('lieu')}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-gray-400"
                  placeholder="Ex : Cathédrale Saint André"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
              <textarea
                required
                value={form.description}
                onChange={set('description')}
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-gray-400 resize-none"
                placeholder="Description de l'évènement…"
              />
            </div>

            {/* Médias — upload Supabase Storage */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Image */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Image de l'évènement *{' '}
                  <span className="text-xs font-normal text-gray-400">max 5 MB</span>
                </label>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                  id="image-upload"
                />
                {form.image_preview ? (
                  <div className="relative rounded-lg overflow-hidden border border-gray-200 h-32">
                    <img
                      src={form.image_preview}
                      alt="Aperçu"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={clearImage}
                      className="absolute top-1.5 right-1.5 bg-white rounded-full p-0.5 shadow"
                    >
                      <X size={14} className="text-gray-700" />
                    </button>
                  </div>
                ) : (
                  <label
                    htmlFor="image-upload"
                    className="flex flex-col items-center justify-center gap-2 h-32 rounded-lg border-2 border-dashed border-gray-200 cursor-pointer hover:border-gray-400 transition-colors bg-gray-50"
                  >
                    <ImagePlus size={22} className="text-gray-400" />
                    <span className="text-xs text-gray-400">Choisir une image</span>
                  </label>
                )}
              </div>

              {/* Vidéo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Vidéo de l'évènement{' '}
                  <span className="text-xs font-normal text-gray-400">optionnelle – max 50 MB</span>
                </label>
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/*"
                  onChange={handleVideoChange}
                  className="hidden"
                  id="video-upload"
                />
                {form.video_name ? (
                  <div className="flex items-center gap-2 h-32 rounded-lg border border-gray-200 bg-gray-50 px-4">
                    <Film size={20} className="text-gray-400 shrink-0" />
                    <span className="text-xs text-gray-600 truncate flex-1">{form.video_name}</span>
                    <button type="button" onClick={clearVideo}>
                      <X size={14} className="text-gray-500" />
                    </button>
                  </div>
                ) : (
                  <label
                    htmlFor="video-upload"
                    className="flex flex-col items-center justify-center gap-2 h-32 rounded-lg border-2 border-dashed border-gray-200 cursor-pointer hover:border-gray-400 transition-colors bg-gray-50"
                  >
                    <Film size={22} className="text-gray-400" />
                    <span className="text-xs text-gray-400">Choisir une vidéo</span>
                  </label>
                )}
              </div>
            </div>

            {/* Prix + Places */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prix (0 = gratuit)</label>
                <input
                  type="number"
                  min={0}
                  value={form.prix}
                  onChange={set('prix')}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-gray-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre de places max <span className="text-gray-400 font-normal">(vide = illimité)</span>
                </label>
                <input
                  type="number"
                  min={1}
                  value={form.nombre_places}
                  onChange={set('nombre_places')}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-gray-400"
                  placeholder="Ex : 100"
                />
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Début de parution *</label>
                <input
                  type="date"
                  required
                  value={form.date_debut}
                  onChange={set('date_debut')}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-gray-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fin de parution</label>
                <input
                  type="date"
                  value={form.date_fin}
                  onChange={set('date_fin')}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-gray-400"
                />
              </div>
            </div>

            {/* Date & Heure réelles de l'évènement */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date de l'évènement <span className="text-gray-400 font-normal">(optionnel)</span>
                </label>
                <input
                  type="date"
                  value={form.date_evenement}
                  onChange={set('date_evenement')}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-gray-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Heure de l'évènement <span className="text-gray-400 font-normal">(optionnel)</span>
                </label>
                <input
                  type="time"
                  value={form.heure_evenement}
                  onChange={set('heure_evenement')}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-gray-400"
                />
              </div>
            </div>

            {/* Checkbox + bouton */}
            <div className="flex items-center justify-between pt-2">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.est_actif}
                  onChange={set('est_actif')}
                  className="rounded"
                />
                <span>Mettre en ligne</span>
              </label>

              <button
                type="submit"
                disabled={saving}
                className="text-white px-6 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50 transition-opacity"
                style={{ backgroundColor: '#8B1A2E' }}
              >
                {saving ? 'Enregistrement…' : editId ? "Mettre à jour" : "Ajouter l'évènement"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* ── Section 2 — Historique des évènements ───────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Georgia, serif' }}>
            Historique des évènements
          </h2>

          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {[
              { value: 'tout', label: 'Tous' },
              { value: 'en_ligne', label: 'En ligne' },
              { value: 'hors_ligne', label: 'Hors ligne' },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setFiltreActif(opt.value)}
                className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
                style={{
                  backgroundColor: filtreActif === opt.value ? 'white' : 'transparent',
                  color: filtreActif === opt.value ? '#111827' : '#6b7280',
                  boxShadow: filtreActif === opt.value ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <DataTable
          columns={colsEvenements}
          data={evenements}
          loading={loadingEvenements}
          actions={(row) => [
            <button
              key="edit"
              onClick={() => openEdit(row)}
              className="flex items-center gap-1 border border-blue-200 text-blue-700 px-2 py-1 rounded text-xs hover:bg-blue-50"
            >
              <Edit2 size={12} /> Modifier
            </button>,
            <button
              key="detail"
              onClick={() => setModalEvenement(row)}
              className="flex items-center gap-1 border border-gray-200 text-gray-600 px-2 py-1 rounded text-xs hover:bg-gray-50"
            >
              <Eye size={12} /> Détails
            </button>,
            (row.image_url || row.video_url) && (
              <a
                key="media"
                href={row.video_url || row.image_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 border border-gray-200 text-gray-600 px-2 py-1 rounded text-xs hover:bg-gray-50"
              >
                <ExternalLink size={12} /> Voir
              </a>
            ),
            <button
              key="toggle"
              onClick={() => toggleActif(row)}
              className="flex items-center gap-1 border border-gray-200 text-gray-600 px-2 py-1 rounded text-xs hover:bg-gray-50"
            >
              {row.est_actif
                ? <><WifiOff size={12} /> Hors ligne</>
                : <><Wifi size={12} /> En ligne</>
              }
            </button>,
            <button
              key="del"
              onClick={() => deleteEvenement(row.id)}
              className="flex items-center gap-1 bg-red-50 text-red-600 px-2 py-1 rounded text-xs hover:bg-red-100"
            >
              <Trash2 size={12} /> Supprimer
            </button>,
          ].filter(Boolean)}
        />
      </div>

      {/* ── Section 3 — Liste des inscrits ──────────────────────────────── */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Georgia, serif' }}>
            Liste des inscrits
          </h2>
          {selectedEvenementId && inscriptions.length > 0 && (
            <span className="flex items-center gap-1 text-sm text-gray-500">
              <Users size={14} />
              {inscriptions.length} inscrit{inscriptions.length > 1 ? 's' : ''}
            </span>
          )}
        </div>

        <div className="mb-4">
          <select
            value={selectedEvenementId}
            onChange={(e) => setSelectedEvenementId(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none w-full max-w-sm"
          >
            <option value="">— Sélectionner un évènement —</option>
            {evenements.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.titre} {ev.date_debut ? `(${fmtDate(ev.date_debut)})` : ''}
              </option>
            ))}
          </select>
        </div>

        {!selectedEvenementId ? (
          <div className="bg-white rounded-xl flex items-center justify-center py-16"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.04)' }}>
            <p className="text-sm text-gray-400">Sélectionnez un évènement pour voir ses inscrits</p>
          </div>
        ) : (
          <DataTable
            columns={colsInscritsFixed}
            data={inscriptions}
            loading={loadingInscriptions}
            actions={(row) => [
              <button
                key="detail"
                onClick={() => setModalInscrit(row)}
                className="flex items-center gap-1 border border-gray-200 text-gray-600 px-2 py-1 rounded text-xs hover:bg-gray-50"
              >
                <Eye size={12} /> Détails
              </button>,
            ]}
          />
        )}
      </div>
      {/* ── Modal détail évènement ──────────────────────────────────────── */}
      <Modal isOpen={!!modalEvenement} onClose={() => setModalEvenement(null)} title="Détail de l'évènement" size="md">
        {modalEvenement && (
          <div className="space-y-4 text-sm">
            {modalEvenement.image_url && (
              <img src={modalEvenement.image_url} alt="visuel" className="w-full h-40 object-cover rounded-lg" />
            )}
            <div className="flex gap-4">
              <span className="text-gray-500 w-28 shrink-0">Titre</span>
              <span className="text-gray-900 font-medium">{modalEvenement.titre}</span>
            </div>
            <div className="flex gap-4">
              <span className="text-gray-500 w-28 shrink-0">Début parution</span>
              <span className="text-gray-900">{fmtDate(modalEvenement.date_debut)}</span>
            </div>
            <div className="flex gap-4">
              <span className="text-gray-500 w-28 shrink-0">Fin parution</span>
              <span className="text-gray-900">{modalEvenement.date_fin ? fmtDate(modalEvenement.date_fin) : '—'}</span>
            </div>
            {modalEvenement.lieu && (
              <div className="flex gap-4">
                <span className="text-gray-500 w-28 shrink-0">Lieu</span>
                <span className="text-gray-900">{modalEvenement.lieu}</span>
              </div>
            )}
            <div className="flex gap-4">
              <span className="text-gray-500 w-28 shrink-0">Prix</span>
              <span className="text-gray-900">{modalEvenement.prix === 0 ? 'Gratuit' : fmtMontant(modalEvenement.prix)}</span>
            </div>
            <div className="flex gap-4">
              <span className="text-gray-500 w-28 shrink-0">Statut</span>
              <Badge label={modalEvenement.est_actif ? 'En ligne' : 'Hors ligne'} value={modalEvenement.est_actif ? 'actif' : 'inactif'} />
            </div>
            {modalEvenement.description && (
              <div>
                <p className="text-gray-500 mb-2">Description</p>
                <div className="bg-gray-50 rounded-lg p-4 text-gray-800 leading-relaxed whitespace-pre-wrap">
                  {modalEvenement.description}
                </div>
              </div>
            )}
            {modalEvenement.video_url && (
              <div className="flex gap-4">
                <span className="text-gray-500 w-28 shrink-0">Vidéo</span>
                <a href={modalEvenement.video_url} target="_blank" rel="noopener noreferrer"
                  className="text-blue-600 underline text-sm flex items-center gap-1">
                  <ExternalLink size={12} /> Voir la vidéo
                </a>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ── Modal détail inscrit ─────────────────────────────────────────── */}
      <Modal isOpen={!!modalInscrit} onClose={() => setModalInscrit(null)} title="Détail de l'inscription" size="sm">
        {modalInscrit && (
          <div className="space-y-4 text-sm">
            <div className="flex gap-4">
              <span className="text-gray-500 w-28 shrink-0">Paroissien</span>
              <span className="text-gray-900 font-medium">{modalInscrit.profiles?.nom || 'Anonyme'}</span>
            </div>
            <div className="flex gap-4">
              <span className="text-gray-500 w-28 shrink-0">Téléphone</span>
              <span className="text-gray-900">{modalInscrit.profiles?.telephone || '—'}</span>
            </div>
            <div className="flex gap-4">
              <span className="text-gray-500 w-28 shrink-0">Date</span>
              <span className="text-gray-900">{fmtDate(modalInscrit.created_at)}</span>
            </div>
            <div className="flex gap-4">
              <span className="text-gray-500 w-28 shrink-0">Évènement</span>
              <span className="text-gray-900">
                {evenements.find(e => String(e.id) === String(modalInscrit.evenement_id))?.titre || '—'}
              </span>
            </div>
            <div className="flex gap-4">
              <span className="text-gray-500 w-28 shrink-0">Montant payé</span>
              <span className="text-gray-900 font-medium">
                {modalInscrit.montant_paye ? fmtMontant(modalInscrit.montant_paye) : '—'}
              </span>
            </div>
            <div className="flex gap-4">
              <span className="text-gray-500 w-28 shrink-0">Statut</span>
              <Badge label={modalInscrit.statut || 'inscrit'} value={modalInscrit.statut || 'inscrit'} />
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
