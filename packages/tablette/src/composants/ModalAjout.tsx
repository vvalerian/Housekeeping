import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from './Modal.js'

/** Ajout spontané d'une tâche libre au plan du jour (origine `ajout_spontane`). */
export function ModalAjout({
  onAjouter,
  onFermer,
}: {
  onAjouter: (libelle: string) => void
  onFermer: () => void
}) {
  const { t } = useTranslation()
  const [libelle, setLibelle] = useState('')
  return (
    <Modal titre={t('ajout.titre')} onFermer={onFermer}>
      <input
        type="text"
        value={libelle}
        onChange={(evenement) => setLibelle(evenement.target.value)}
        placeholder={t('ajout.placeholder')}
        autoFocus
        className="h-14 w-full rounded-xl border-2 border-slate-200 px-4 text-slate-800 placeholder:text-slate-400"
      />
      <button
        type="button"
        disabled={libelle.trim() === ''}
        onClick={() => onAjouter(libelle.trim())}
        className="mt-4 h-14 w-full rounded-xl bg-slate-900 font-semibold text-white disabled:bg-slate-300"
      >
        {t('ajout.ajouter')}
      </button>
    </Modal>
  )
}
