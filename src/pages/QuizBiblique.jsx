import { useState, useEffect, useCallback } from 'react'
import { Plus, Edit2, Trash2, BookOpen, Trophy, ToggleLeft, ToggleRight } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { supabase, q } from '../lib/supabase'
import Modal from '../components/Modal'
import DataTable from '../components/DataTable'
import Toast from '../components/Toast'

const PAGE_SIZE = 20

const DIFFICULTES = [
  { value: 'facile',    label: 'Facile',    color: 'bg-green-100 text-green-800' },
  { value: 'normal',   label: 'Normal',    color: 'bg-blue-100 text-blue-800'   },
  { value: 'difficile', label: 'Difficile', color: 'bg-red-100 text-red-800'    },
]

function diffBadge(d) {
  const found = DIFFICULTES.find(x => x.value === d)
  if (!found) return null
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${found.color}`}>
      {found.label}
    </span>
  )
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Tab Questions ──────────────────────────────────────────────────────────

function TabQuestions() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [toast, setToast] = useState(null)
  const [search, setSearch] = useState('')

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm()
  const showToast = (msg, type = 'success') => setToast({ msg, type })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('quiz_questions')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
      if (search) query = query.ilike('question', `%${search}%`)
      const { data, count } = await q(query)
      setItems(data || [])
      setTotal(count || 0)
    } catch (err) {
      console.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => { load() }, [load])

  const openAdd = () => {
    setEditItem(null)
    reset({
      question: '', option_a: '', option_b: '', option_c: '', option_d: '',
      bonne_reponse: 'a', explication: '', categorie: 'Général', difficulte: 'normal', est_actif: true,
    })
    setModal(true)
  }

  const openEdit = (item) => {
    setEditItem(item)
    reset({
      question: item.question,
      option_a: item.option_a,
      option_b: item.option_b,
      option_c: item.option_c,
      option_d: item.option_d,
      bonne_reponse: item.bonne_reponse,
      explication: item.explication || '',
      categorie: item.categorie || 'Général',
      difficulte: item.difficulte || 'normal',
      est_actif: item.est_actif,
    })
    setModal(true)
  }

  const save = async (data) => {
    try {
      const payload = {
        question: data.question.trim(),
        option_a: data.option_a.trim(),
        option_b: data.option_b.trim(),
        option_c: data.option_c.trim(),
        option_d: data.option_d.trim(),
        bonne_reponse: data.bonne_reponse,
        explication: data.explication?.trim() || null,
        categorie: data.categorie?.trim() || 'Général',
        difficulte: data.difficulte || 'normal',
        est_actif: data.est_actif === true || data.est_actif === 'true',
      }
      if (editItem) {
        await q(supabase.from('quiz_questions').update(payload).eq('id', editItem.id))
      } else {
        await q(supabase.from('quiz_questions').insert(payload))
      }
      showToast('Question enregistrée ✓')
      setModal(false)
      setEditItem(null)
      reset()
      load()
    } catch (err) {
      showToast('Erreur : ' + err.message, 'error')
    }
  }

  const toggleActif = async (item) => {
    try {
      await q(supabase.from('quiz_questions').update({ est_actif: !item.est_actif }).eq('id', item.id))
      showToast(item.est_actif ? 'Désactivée' : 'Activée')
      load()
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  const deleteItem = async (id) => {
    if (!confirm('Supprimer cette question ?')) return
    try {
      await q(supabase.from('quiz_questions').delete().eq('id', id))
      showToast('Supprimée')
      load()
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  const cols = [
    {
      key: 'question',
      label: 'Question',
      render: v => (
        <span className="text-sm text-gray-800 leading-snug font-medium">
          {v.length > 80 ? v.slice(0, 80) + '…' : v}
        </span>
      ),
    },
    { key: 'categorie', label: 'Catégorie', render: v => <span className="text-xs text-gray-500">{v || '—'}</span> },
    { key: 'difficulte', label: 'Difficulté', render: v => diffBadge(v) },
    {
      key: 'bonne_reponse',
      label: 'Réponse',
      render: v => (
        <span className="text-xs font-mono font-bold uppercase bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
          {v}
        </span>
      ),
    },
    {
      key: 'est_actif',
      label: 'Statut',
      render: v => v
        ? <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full font-medium">Actif</span>
        : <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">Inactif</span>,
    },
  ]

  return (
    <div className="space-y-4">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          placeholder="Rechercher une question…"
          className="flex-1 max-w-sm px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none"
        />
        <button
          onClick={openAdd}
          className="flex items-center gap-2 text-white px-4 py-2 rounded-lg text-sm font-medium shrink-0"
          style={{ backgroundColor: '#8B1A2E' }}
        >
          <Plus size={16} /> Ajouter une question
        </button>
      </div>

      <DataTable
        columns={cols}
        data={items}
        loading={loading}
        pagination={{ page, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)), total }}
        onPageChange={setPage}
        actions={row => [
          <button
            key="t"
            onClick={() => toggleActif(row)}
            className="flex items-center gap-1 border border-gray-200 text-gray-600 px-2 py-1 rounded text-xs hover:bg-gray-50"
          >
            {row.est_actif
              ? <ToggleRight size={14} style={{ color: '#15803d' }} />
              : <ToggleLeft size={14} />}
            {row.est_actif ? 'Actif' : 'Inactif'}
          </button>,
          <button
            key="e"
            onClick={() => openEdit(row)}
            className="flex items-center gap-1 border border-gray-200 text-gray-600 px-2 py-1 rounded text-xs hover:bg-gray-50"
          >
            <Edit2 size={12} /> Modifier
          </button>,
          <button
            key="d"
            onClick={() => deleteItem(row.id)}
            className="flex items-center gap-1 bg-red-50 text-red-600 px-2 py-1 rounded text-xs hover:bg-red-100"
          >
            <Trash2 size={12} /> Supprimer
          </button>,
        ]}
      />

      <Modal
        isOpen={modal}
        onClose={() => { setModal(false); setEditItem(null) }}
        title={editItem ? 'Modifier la question' : 'Nouvelle question'}
        size="lg"
      >
        <form onSubmit={handleSubmit(save)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Question <span className="text-red-500">*</span>
            </label>
            <textarea
              {...register('question', { required: true })}
              rows={3}
              placeholder="Ex : Qui a baptisé Jésus dans le Jourdain ?"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {['a', 'b', 'c', 'd'].map(letter => (
              <div key={letter}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Option {letter.toUpperCase()} <span className="text-red-500">*</span>
                </label>
                <input
                  {...register(`option_${letter}`, { required: true })}
                  placeholder={`Réponse ${letter.toUpperCase()}`}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none"
                />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bonne réponse <span className="text-red-500">*</span>
              </label>
              <select
                {...register('bonne_reponse', { required: true })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none bg-white"
              >
                <option value="a">A</option>
                <option value="b">B</option>
                <option value="c">C</option>
                <option value="d">D</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label>
              <input
                {...register('categorie')}
                placeholder="Ex : Nouveau Testament"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Difficulté</label>
              <select
                {...register('difficulte')}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none bg-white"
              >
                {DIFFICULTES.map(d => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Explication (optionnel)</label>
            <textarea
              {...register('explication')}
              rows={2}
              placeholder="Explication affichée après la réponse…"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none resize-none"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" {...register('est_actif')} defaultChecked className="rounded" />
            <span className="text-sm text-gray-700">Active (incluse dans les sessions de quiz)</span>
          </label>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full text-white py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60"
            style={{ backgroundColor: '#8B1A2E' }}
          >
            {isSubmitting ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </form>
      </Modal>
    </div>
  )
}

// ── Tab Classement ─────────────────────────────────────────────────────────

function TabClassement() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data, count } = await q(
        supabase
          .from('quiz_sessions')
          .select('id, score, total, created_at, profiles(nom)', { count: 'exact' })
          .order('score', { ascending: false })
          .order('created_at', { ascending: true })
          .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
      )
      const offset = (page - 1) * PAGE_SIZE
      const ranked = (data || []).map((row, i) => ({
        ...row,
        _rank: offset + i + 1,
        _pct: row.total > 0 ? Math.round((row.score / row.total) * 100) : 0,
      }))
      setSessions(ranked)
      setTotal(count || 0)
    } catch (err) {
      console.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => { load() }, [load])

  const cols = [
    {
      key: '_rank',
      label: '#',
      render: v => {
        if (v === 1) return <span className="text-xl">🥇</span>
        if (v === 2) return <span className="text-xl">🥈</span>
        if (v === 3) return <span className="text-xl">🥉</span>
        return <span className="text-sm text-gray-400 font-mono">#{v}</span>
      },
    },
    {
      key: 'profiles',
      label: 'Utilisateur',
      render: v => (
        <span className="text-sm font-medium text-gray-800">{v?.nom || 'Anonyme'}</span>
      ),
    },
    {
      key: 'score',
      label: 'Score',
      render: (v, row) => (
        <span className="text-sm font-bold" style={{ color: '#8B1A2E' }}>
          {v} / {row.total}
        </span>
      ),
    },
    {
      key: '_pct',
      label: 'Résultat',
      render: v => {
        let cls = 'bg-red-100 text-red-700'
        if (v >= 80) cls = 'bg-green-100 text-green-800'
        else if (v >= 50) cls = 'bg-blue-100 text-blue-800'
        return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>{v}%</span>
      },
    },
    {
      key: 'created_at',
      label: 'Date',
      render: v => <span className="text-xs text-gray-400">{fmtDate(v)}</span>,
    },
  ]

  return (
    <DataTable
      columns={cols}
      data={sessions}
      loading={loading}
      pagination={{ page, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)), total }}
      onPageChange={setPage}
    />
  )
}

// ── Page principale ────────────────────────────────────────────────────────

export default function QuizBiblique() {
  const [tab, setTab] = useState('questions')

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: '#E8EAF6' }}
        >
          <BookOpen size={18} style={{ color: '#1A237E' }} />
        </div>
        <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Georgia, serif' }}>
          Quiz Biblique
        </h2>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ backgroundColor: '#F3F4F6' }}>
        {[
          { key: 'questions', label: 'Questions', icon: BookOpen },
          { key: 'classement', label: 'Classement', icon: Trophy },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {tab === 'questions' && <TabQuestions />}
      {tab === 'classement' && <TabClassement />}
    </div>
  )
}
