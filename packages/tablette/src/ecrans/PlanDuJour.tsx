import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAjoutSpontane, usePieces, useTaches, useValiderInstance } from '../api.js'
import { CartePiece } from '../composants/CartePiece.js'
import { MenuMotif } from '../composants/MenuMotif.js'
import { ModalAjout } from '../composants/ModalAjout.js'
import { grouperParPiece, progression } from '../lib.js'
import type { InstanceDto, PlanDuJourDto } from '../types.js'

/**
 * Écran principal (SPEC §6) : une carte par pièce, lignes cochables, barre de
 * progression discrète — jamais de compte à rebours ni de durée.
 */
export function PlanDuJour({
  plan,
  onCloturer,
}: {
  plan: PlanDuJourDto
  onCloturer: () => void
}) {
  const { t } = useTranslation()
  const pieces = usePieces()
  const taches = useTaches()
  const valider = useValiderInstance()
  const ajouter = useAjoutSpontane()
  const [instanceMotifs, setInstanceMotifs] = useState<InstanceDto | null>(null)
  const [ajoutOuvert, setAjoutOuvert] = useState(false)

  const groupes = useMemo(
    () => grouperParPiece(plan.instances, pieces.data ?? []),
    [plan.instances, pieces.data],
  )
  const definitions = useMemo(
    () => new Map((taches.data ?? []).map((definition) => [definition.id, definition])),
    [taches.data],
  )
  const { traitees, total, ratio } = progression(plan.instances)

  const basculer = (instance: InstanceDto) => {
    valider.mutate({
      instanceId: instance.id,
      statut: instance.statut === 'faite' ? 'a_faire' : 'faite',
    })
  }

  return (
    <div className="min-h-dvh pb-28">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-slate-100/95 px-4 pt-3 pb-2 backdrop-blur">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-baseline justify-between gap-3">
            <h1 className="truncate font-semibold text-slate-800">
              {t(`typePassage.${plan.intervention.type}`)}
            </h1>
            <p className="shrink-0 text-slate-500">{t('plan.progression', { traitees, total })}</p>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${Math.round(ratio * 100)}%` }}
            />
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-4">
        {groupes.map((groupe) => (
          <CartePiece
            key={groupe.cle}
            groupe={groupe}
            definitions={definitions}
            onBasculer={basculer}
            onOuvrirMotifs={setInstanceMotifs}
          />
        ))}

        <button
          type="button"
          onClick={() => setAjoutOuvert(true)}
          className="h-14 rounded-2xl border-2 border-dashed border-slate-300 font-medium text-slate-500 active:bg-slate-50"
        >
          + {t('plan.ajouterTache')}
        </button>

        <button
          type="button"
          onClick={onCloturer}
          className="h-16 rounded-2xl bg-slate-900 text-lg font-bold text-white shadow-md active:bg-slate-700"
        >
          {t('plan.cloturer')}
        </button>
      </main>

      {instanceMotifs !== null && (
        <MenuMotif
          instance={instanceMotifs}
          onFermer={() => setInstanceMotifs(null)}
          onValider={({ statut, motif, commentaire }) => {
            valider.mutate({
              instanceId: instanceMotifs.id,
              statut,
              motif_non_faite: motif,
              commentaire,
            })
            setInstanceMotifs(null)
          }}
        />
      )}

      {ajoutOuvert && (
        <ModalAjout
          onFermer={() => setAjoutOuvert(false)}
          onAjouter={(libelle) => {
            ajouter.mutate({ interventionId: plan.intervention.id, libelle })
            setAjoutOuvert(false)
          }}
        />
      )}
    </div>
  )
}
