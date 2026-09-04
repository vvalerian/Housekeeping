import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MotifNonFaiteSchema } from '@housekeeping/core'
import type { InstanceDto, MotifNonFaite } from '../types.js'
import { Modal } from './Modal.js'

/**
 * Le menu « je n'ai pas pu faire » (SPEC §6) : statut (pas fait / en partie),
 * motif prédéfini, commentaire facultatif.
 */
export function MenuMotif({
  instance,
  onValider,
  onFermer,
}: {
  instance: InstanceDto
  onValider: (validation: {
    statut: 'non_faite' | 'partielle' | 'a_faire'
    motif: MotifNonFaite | null
    commentaire: string | null
  }) => void
  onFermer: () => void
}) {
  const { t } = useTranslation()
  const [statut, setStatut] = useState<'non_faite' | 'partielle'>(
    instance.statut === 'partielle' ? 'partielle' : 'non_faite',
  )
  const [motif, setMotif] = useState<MotifNonFaite | null>(instance.motif_non_faite)
  const [commentaire, setCommentaire] = useState(instance.commentaire ?? '')

  const segment = (valeur: 'non_faite' | 'partielle', libelle: string) => (
    <button
      type="button"
      onClick={() => setStatut(valeur)}
      aria-pressed={statut === valeur}
      className={`h-14 flex-1 rounded-xl border-2 font-medium ${
        statut === valeur
          ? 'border-slate-800 bg-slate-800 text-white'
          : 'border-slate-200 bg-white text-slate-700'
      }`}
    >
      {libelle}
    </button>
  )

  return (
    <Modal titre={instance.libelle} onFermer={onFermer}>
      <div className="flex gap-3">
        {segment('non_faite', t('motifs.statutNonFaite'))}
        {segment('partielle', t('motifs.statutPartielle'))}
      </div>

      <p className="mt-5 mb-2 font-medium text-slate-700">{t('motifs.sousTitre')}</p>
      <div className="grid grid-cols-2 gap-3">
        {MotifNonFaiteSchema.options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setMotif(option)}
            aria-pressed={motif === option}
            className={`min-h-14 rounded-xl border-2 px-3 ${
              motif === option
                ? 'border-amber-500 bg-amber-50 font-medium text-amber-900'
                : 'border-slate-200 bg-white text-slate-700'
            }`}
          >
            {t(`motifs.${option}`)}
          </button>
        ))}
      </div>

      <textarea
        value={commentaire}
        onChange={(evenement) => setCommentaire(evenement.target.value)}
        placeholder={t('motifs.commentaire')}
        rows={2}
        className="mt-4 w-full rounded-xl border-2 border-slate-200 p-3 text-slate-800 placeholder:text-slate-400"
      />

      <div className="mt-5 flex flex-col gap-3">
        <button
          type="button"
          disabled={motif === null}
          onClick={() =>
            onValider({ statut, motif, commentaire: commentaire.trim() === '' ? null : commentaire.trim() })
          }
          className="h-14 rounded-xl bg-slate-900 font-semibold text-white disabled:bg-slate-300"
        >
          {t('commun.valider')}
        </button>
        {instance.statut !== 'a_faire' && (
          <button
            type="button"
            onClick={() => onValider({ statut: 'a_faire', motif: null, commentaire: null })}
            className="h-14 rounded-xl border-2 border-slate-200 font-medium text-slate-700"
          >
            {t('motifs.remettreAFaire')}
          </button>
        )}
      </div>
    </Modal>
  )
}
