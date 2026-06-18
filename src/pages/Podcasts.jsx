import { useState, useEffect, useCallback } from 'react'
import { Plus, Edit2, Trash2, Mic, ShoppingBag, Upload, CheckCircle, Loader } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { supabase, q } from '../lib/supabase'
import Modal from '../components/Modal'
import Badge from '../components/Badge'
import DataTable from '../components/DataTable'
import Toast from '../components/Toast'
import ImageUpload from '../components/ImageUpload'
import { fmtMontant, fmtDate } from '../lib/helpers'

const PAGE_SIZE = 20

export default function Podcasts() {
  const [series, setSeries] = useState([])
  const [episodes, setEpisodes] = useState([])
  const [achats, setAchats] = useState([])
  const [loadingSeries, setLoadingSeries] = useState(true)
  const [loadingEps, setLoadingEps] = useState(false)
  const [loadingAchats, setLoadingAchats] = useState(true)
  const [modalSerie, setModalSerie] = useState(false)
  const [modalEpisode, setModalEpisode] = useState(false)
  const [editSerie, setEditSerie] = useState(null)
  const [editEpisode, setEditEpisode] = useState(null)
  const [serieFiltree, setSerieFiltree] = useState('tout')
  const [pageSeries, setPageSeries] = useState(1)
  const [pageEps, setPageEps] = useState(1)
  const [totalEps, setTotalEps] = useState(0)
  const [toast, setToast] = useState(null)
  const [imageUrl, setImageUrl] = useState('')
  const [activeTab, setActiveTab] = useState('series')
  // Upload vidéo direct (Supabase storage — pour les non-YouTube)
  const [videoUploadUrl, setVideoUploadUrl] = useState('')
  const [uploadingVideo, setUploadingVideo] = useState(false)

  const { register: regSerie, handleSubmit: hsSerie, reset: resetSerie } = useForm()
  const { register: regEp, handleSubmit: hsEp, reset: resetEp } = useForm()
  const showToast = (msg, type = 'success') => setToast({ msg, type })

  const loadSeries = async () => {
    setLoadingSeries(true)
    const { data } = await supabase.from('podcast_series')
      .select('*, podcast_episodes(count)')
      .order('created_at', { ascending: false })
    setSeries(data || [])
    setLoadingSeries(false)
  }

  const loadEpisodes = useCallback(async () => {
    setLoadingEps(true)
    let query = supabase.from('podcast_episodes')
      .select('*, podcast_series(titre)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((pageEps - 1) * PAGE_SIZE, pageEps * PAGE_SIZE - 1)

    if (serieFiltree !== 'tout') query = query.eq('serie_id', serieFiltree)

    const { data, count } = await query
    setEpisodes(data || [])
    setTotalEps(count || 0)
    setLoadingEps(false)
  }, [pageEps, serieFiltree])

  const loadAchats = async () => {
    setLoadingAchats(true)
    const { data, error } = await supabase.from('podcast_achats')
      .select('*, podcast_episodes(titre)')
      .order('created_at', { ascending: false })
      .limit(100)
    if (error) { setLoadingAchats(false); return }
    const uids = [...new Set((data || []).map(r => r.user_id).filter(Boolean))]
    let profsMap = {}
    if (uids.length > 0) {
      const { data: profs } = await supabase.from('profiles').select('id, nom, telephone').in('id', uids)
      ;(profs || []).forEach(p => { profsMap[p.id] = p })
    }
    setAchats((data || []).map(r => ({ ...r, profiles: profsMap[r.user_id] || null })))
    setLoadingAchats(false)
  }

  useEffect(() => { loadSeries(); loadAchats() }, [])
  useEffect(() => { if (activeTab === 'episodes') loadEpisodes() }, [loadEpisodes, activeTab])

  const openEditSerie = (s) => {
    setEditSerie(s)
    setImageUrl(s.image_url || '')
    resetSerie({
      titre: s.titre,
      description: s.description || '',
      est_actif: s.est_actif !== false,
    })
    setModalSerie(true)
  }

  const saveSerie = async (data) => {
    try {
      const payload = {
        titre: data.titre,
        description: data.description || null,
        image_url: imageUrl || null,
        est_actif: data.est_actif !== false,
      }
      if (editSerie) {
        await q(supabase.from('podcast_series').update(payload).eq('id', editSerie.id))
      } else {
        await q(supabase.from('podcast_series').insert(payload))
      }
      showToast('Série enregistrée')
      setModalSerie(false)
      setEditSerie(null)
      setImageUrl('')
      resetSerie()
      loadSeries()
    } catch {
      showToast('Erreur', 'error')
    }
  }

  const deleteSerie = async (id) => {
    if (!confirm('Supprimer cette série et tous ses épisodes ?')) return
    await q(supabase.from('podcast_episodes').delete().eq('serie_id', id))
    await q(supabase.from('podcast_series').delete().eq('id', id))
    showToast('Série supprimée')
    loadSeries()
  }

  const handleVideoUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingVideo(true)
    try {
      const ext = file.name.split('.').pop().toLowerCase()
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error } = await supabase.storage.from('podcast_videos').upload(path, file)
      if (error) throw error
      const { data } = supabase.storage.from('podcast_videos').getPublicUrl(path)
      setVideoUploadUrl(data.publicUrl)
      showToast('Vidéo uploadée ✓')
    } catch (err) {
      showToast('Erreur upload : ' + err.message, 'error')
    } finally {
      setUploadingVideo(false)
    }
  }

  const openEditEp = (ep) => {
    setEditEpisode(ep)
    // Détection : URL directe (non-YouTube) → on la met dans videoUploadUrl
    const existingUrl = ep.url_media || ep.url_video || ''
    const isYoutube = existingUrl.includes('youtube') || existingUrl.includes('youtu.be')
    setVideoUploadUrl(isYoutube ? '' : existingUrl)
    resetEp({
      titre: ep.titre,
      description: ep.description || '',
      serie_id: ep.serie_id,
      type: ep.format || ep.type || 'audio',
      duree: ep.duree || '',
      url_audio: ep.url_audio || ep.url_media || '',
      url_video: isYoutube ? existingUrl : '',
      est_gratuit: ep.est_gratuit !== false,
      prix: ep.prix || '',
      numero: ep.numero || '',
    })
    setModalEpisode(true)
  }

  const saveEpisode = async (data) => {
    try {
      // videoUploadUrl (fichier uploadé) a priorité sur url_video (YouTube saisi manuellement)
      const finalVideoUrl = videoUploadUrl || data.url_video || null
      const payload = {
        titre: data.titre,
        description: data.description || null,
        serie_id: data.serie_id || null,
        format: data.type || 'audio',
        duree: data.duree ? parseInt(data.duree) : null,
        url_audio: data.url_audio || null,
        url_video: finalVideoUrl,
        url_media: data.url_audio || finalVideoUrl || '',
        est_gratuit: data.est_gratuit !== false,
        prix: data.prix ? parseInt(data.prix) : null,
        numero: data.numero ? parseInt(data.numero) : null,
      }
      if (editEpisode) {
        await q(supabase.from('podcast_episodes').update(payload).eq('id', editEpisode.id))
      } else {
        await q(supabase.from('podcast_episodes').insert(payload))
      }
      showToast('Épisode enregistré ✓')
      setModalEpisode(false); setEditEpisode(null); resetEp(); setVideoUploadUrl('')
      loadEpisodes()
    } catch (err) {
      showToast('Erreur : ' + err.message, 'error')
    }
  }

  const deleteEp = async (id) => {
    if (!confirm('Supprimer cet épisode ?')) return
    await q(supabase.from('podcast_episodes').delete().eq('id', id))
    showToast('Épisode supprimé')
    loadEpisodes()
  }

  const colsEpisodes = [
    { key: 'numero', label: '#', render: v => v || '—' },
    { key: 'titre', label: 'Titre', render: v => <span className="font-medium">{v}</span> },
    { key: 'podcast_series', label: 'Série', render: v => v?.titre || '—' },
    { key: 'format', label: 'Type', render: v => <Badge label={v} value={v} /> },
    {
      key: 'est_gratuit', label: 'Accès', render: (v, row) => (
        <Badge label={v ? 'Gratuit' : `Payant ${row.prix ? fmtMontant(row.prix) : ''}`} value={v ? 'gratuit' : 'payant'} />
      )
    },
    { key: 'duree', label: 'Durée', render: v => v ? `${v} min` : '—' },
    { key: 'created_at', label: 'Date', render: v => fmtDate(v) },
  ]

  const colsAchats = [
    { key: 'profiles', label: 'Utilisateur', render: v => v?.nom || '—' },
    { key: 'podcast_episodes', label: 'Épisode', render: v => v?.titre || '—' },
    { key: 'montant', label: 'Montant', render: v => fmtMontant(v) },
    { key: 'operateur_paiement', label: 'Opérateur' },
    { key: 'statut', label: 'Statut', render: v => <Badge label={v} value={v} /> },
    { key: 'created_at', label: 'Date', render: v => fmtDate(v) },
  ]

  const TABS = [
    { key: 'series', label: 'Séries', icon: Mic },
    { key: 'episodes', label: 'Épisodes' },
    { key: 'achats', label: 'Achats', icon: ShoppingBag },
  ]

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Georgia, serif' }}>Podcasts</h2>
        <div className="flex gap-2">
          {activeTab === 'series' && (
            <button onClick={() => { setEditSerie(null); setImageUrl(''); resetSerie(); setModalSerie(true) }}
              className="flex items-center gap-2 text-white px-4 py-2 rounded-lg text-sm font-medium" style={{ backgroundColor: '#8B1A2E' }}>
              <Plus size={16} /> Nouvelle série
            </button>
          )}
          {activeTab === 'episodes' && (
            <button onClick={() => { setEditEpisode(null); resetEp(); setModalEpisode(true) }}
              className="flex items-center gap-2 text-white px-4 py-2 rounded-lg text-sm font-medium" style={{ backgroundColor: '#8B1A2E' }}>
              <Plus size={16} /> Nouvel épisode
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* SÉRIES */}
      {activeTab === 'series' && (
        <div className="space-y-4">
          {loadingSeries ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => <div key={i} className="h-40 bg-gray-100 rounded-xl animate-pulse" />)}
            </div>
          ) : series.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">Aucune série</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {series.map(s => (
                <div key={s.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  {s.image_url && <img src={s.image_url} alt={s.titre} className="w-full h-32 object-cover" />}
                  <div className="p-4">
                    <div className="flex items-start justify-between">
                      <h3 className="font-semibold text-gray-900 text-sm">{s.titre}</h3>
                      <span className={`text-xs font-medium ${s.est_actif ? 'text-green-600' : 'text-gray-400'}`}>
                        {s.est_actif ? 'Actif' : 'Inactif'}
                      </span>
                    </div>
                    {s.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{s.description}</p>}
                    <p className="text-xs text-gray-400 mt-2">{s.podcast_episodes?.[0]?.count || 0} épisode(s)</p>
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => openEditSerie(s)} className="flex items-center gap-1 text-blue-600 text-xs font-medium hover:underline">
                        <Edit2 size={12} /> Modifier
                      </button>
                      <button onClick={() => deleteSerie(s.id)} className="flex items-center gap-1 text-red-600 text-xs font-medium hover:underline">
                        <Trash2 size={12} /> Supprimer
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ÉPISODES */}
      {activeTab === 'episodes' && (
        <div className="space-y-4">
          <div className="flex gap-3">
            <select
              value={serieFiltree}
              onChange={e => { setSerieFiltree(e.target.value); setPageEps(1) }}
              className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none"
            >
              <option value="tout">Toutes les séries</option>
              {series.map(s => <option key={s.id} value={s.id}>{s.titre}</option>)}
            </select>
          </div>
          <DataTable
            columns={colsEpisodes}
            data={episodes}
            loading={loadingEps}
            pagination={{ page: pageEps, totalPages: Math.max(1, Math.ceil(totalEps / PAGE_SIZE)), total: totalEps }}
            onPageChange={setPageEps}
            actions={row => [
              <button key="e" onClick={() => openEditEp(row)} className="flex items-center gap-1 border border-gray-200 text-gray-600 px-2 py-1 rounded text-xs hover:bg-gray-50">
                <Edit2 size={12} /> Modifier
              </button>,
              <button key="d" onClick={() => deleteEp(row.id)} className="flex items-center gap-1 bg-red-50 text-red-600 px-2 py-1 rounded text-xs hover:bg-red-100">
                <Trash2 size={12} /> Supprimer
              </button>,
            ]}
          />
        </div>
      )}

      {/* ACHATS */}
      {activeTab === 'achats' && (
        <DataTable
          columns={colsAchats}
          data={achats}
          loading={loadingAchats}
        />
      )}

      {/* Modal série */}
      <Modal isOpen={modalSerie} onClose={() => { setModalSerie(false); setEditSerie(null) }} title={editSerie ? 'Modifier la série' : 'Nouvelle série'} size="md">
        <form onSubmit={hsSerie(saveSerie)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Titre *</label>
            <input {...regSerie('titre', { required: true })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea {...regSerie('description')} rows={3} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none resize-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Image de couverture</label>
            <ImageUpload bucket="podcasts" currentUrl={imageUrl} onUpload={url => setImageUrl(url || '')} />
            <input type="text" value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="Ou URL de l'image" className="mt-2 w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none" />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" {...regSerie('est_actif')} defaultChecked />
            <span>Visible dans l'app</span>
          </label>
          <button type="submit" className="w-full text-white py-2.5 rounded-lg text-sm font-semibold" style={{ backgroundColor: '#8B1A2E' }}>
            Enregistrer
          </button>
        </form>
      </Modal>

      {/* Modal épisode */}
      <Modal isOpen={modalEpisode} onClose={() => { setModalEpisode(false); setEditEpisode(null) }} title={editEpisode ? 'Modifier l\'épisode' : 'Nouvel épisode'} size="lg">
        <form onSubmit={hsEp(saveEpisode)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Titre *</label>
              <input {...regEp('titre', { required: true })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Numéro</label>
              <input type="number" {...regEp('numero')} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Série</label>
              <select {...regEp('serie_id')} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none">
                <option value="">Sans série</option>
                {series.map(s => <option key={s.id} value={s.id}>{s.titre}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select {...regEp('type')} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none">
                <option value="audio">Audio</option>
                <option value="video">Vidéo</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea {...regEp('description')} rows={3} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none resize-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">URL audio / podcast</label>
            <input {...regEp('url_audio')} type="url" placeholder="https://..." className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">URL YouTube (lien externe)</label>
            <input {...regEp('url_video')} type="url" placeholder="https://youtube.com/watch?v=..." className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none" />
          </div>

          {/* Upload direct — pour les fichiers stockés dans Supabase */}
          <div className="border border-dashed border-gray-300 rounded-lg p-4 bg-gray-50">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">— Ou uploader une vidéo directement —</p>
            {videoUploadUrl ? (
              <div className="flex items-center gap-3">
                <CheckCircle size={18} className="text-green-600 shrink-0" />
                <span className="text-sm text-green-700 font-medium truncate flex-1">Vidéo uploadée</span>
                <button
                  type="button"
                  onClick={() => setVideoUploadUrl('')}
                  className="text-xs text-red-500 hover:underline shrink-0"
                >
                  Retirer
                </button>
              </div>
            ) : (
              <label className={`flex items-center gap-2 cursor-pointer px-4 py-2 rounded-lg border border-gray-300 bg-white hover:border-red-400 transition-colors w-fit ${uploadingVideo ? 'opacity-50 pointer-events-none' : ''}`}>
                {uploadingVideo
                  ? <Loader size={15} className="text-gray-400 animate-spin" />
                  : <Upload size={15} className="text-gray-400" />}
                <span className="text-sm text-gray-600">
                  {uploadingVideo ? 'Upload en cours…' : 'Choisir un fichier MP4 / MOV'}
                </span>
                <input
                  type="file"
                  accept="video/mp4,video/quicktime,video/x-m4v,video/*"
                  className="hidden"
                  disabled={uploadingVideo}
                  onChange={handleVideoUpload}
                />
              </label>
            )}
            <p className="text-xs text-gray-400 mt-2">Le fichier sera stocké dans le bucket <code>podcast_videos</code> de Supabase.</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Durée (minutes)</label>
              <input type="number" {...regEp('duree')} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prix (FCFA, si payant)</label>
              <input type="number" {...regEp('prix')} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" {...regEp('est_gratuit')} defaultChecked />
            <span>Gratuit</span>
          </label>
          <button type="submit" className="w-full text-white py-2.5 rounded-lg text-sm font-semibold" style={{ backgroundColor: '#8B1A2E' }}>
            Enregistrer
          </button>
        </form>
      </Modal>
    </div>
  )
}
