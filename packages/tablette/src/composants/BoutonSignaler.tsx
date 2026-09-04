import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { TypeSignalementSchema } from '@housekeeping/core'
import { useSignaler } from '../api.js'
import type { TypeSignalement } from '../types.js'
import { Modal } from './Modal.js'

/**
 * Bouton flottant permanent « Signaler » (SPEC §6) : deux touches maximum
 * jusqu'à la saisie — 1) le bouton, 2) le type, puis le texte.
 */
export function BoutonSignaler({ interventionId }: { interventionId: string | null }) {
  const { t } = useTranslation()
  const signaler = useSignaler()
  const [etape, setEtape] = useState<'ferme' | 'type' | TypeSignalement>('ferme')
  const [texte, setTexte] = useState('')
  const [toast, setToast] = useState(false)

  const fermer = () => {
    setEtape('ferme')
    setTexte('')
  }

  const envoyer = (type: TypeSignalement) => {
    signaler.mutate(
      { type, texte: texte.trim(), intervention_id: interventionId },
      {
        onSuccess: () => {
          fermer()
          setToast(true)
          setTimeout(() => setToast(false), 3000)
        },
      },
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setEtape('type')}
        className="fixed right-5 bottom-5 z-30 flex h-14 items-center gap-2 rounded-full bg-slate-900 px-6 font-semibold text-white shadow-lg active:bg-slate-700"
      >
        <span aria-hidden="true">⚠</span> {t('signaler.bouton')}
      </button>

      {toast && (
        <p
          role="status"
          className="fixed bottom-24 left-1/2 z-30 -translate-x-1/2 rounded-full bg-emerald-600 px-5 py-2.5 font-medium text-white shadow-lg"
        >
          {t('signaler.envoye')}
        </p>
      )}

      {etape === 'type' && (
        <Modal titre={t('signaler.titre')} onFermer={fermer}>
          <div className="flex flex-col gap-3">
            {TypeSignalementSchema.options.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setEtape(type)}
                className="h-14 rounded-xl border-2 border-slate-200 bg-white px-4 text-left font-medium text-slate-800 active:bg-slate-50"
              >
                {t(`signaler.${type}`)}
              </button>
            ))}
          </div>
        </Modal>
      )}

      {etape !== 'ferme' && etape !== 'type' && (
        <Modal titre={t(`signaler.${etape}`)} onFermer={fermer}>
          <textarea
            value={texte}
            onChange={(evenement) => setTexte(evenement.target.value)}
            placeholder={t('signaler.placeholder')}
            rows={3}
            autoFocus
            className="w-full rounded-xl border-2 border-slate-200 p-3 text-slate-800 placeholder:text-slate-400"
          />
          <button
            type="button"
            disabled={texte.trim() === '' || signaler.isPending}
            onClick={() => envoyer(etape)}
            className="mt-4 h-14 w-full rounded-xl bg-slate-900 font-semibold text-white disabled:bg-slate-300"
          >
            {t('commun.envoyer')}
          </button>
        </Modal>
      )}
    </>
  )
}
