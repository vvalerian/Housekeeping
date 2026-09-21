import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useCloturer, useTaches } from '../api.js'
import { libelleInstance } from '../lib.js'
import type { PlanDuJourDto } from '../types.js'

/**
 * Écran de clôture (SPEC §6) : récapitulatif fait / pas fait, note libre
 * facultative, « Terminer ». Aucun blocage si des tâches restent non cochées.
 */
export function Cloture({
  plan,
  onRetour,
  onTerminee,
}: {
  plan: PlanDuJourDto
  onRetour: () => void
  onTerminee: () => void
}) {
  const { t, i18n } = useTranslation()
  const cloturer = useCloturer()
  const taches = useTaches()
  const [note, setNote] = useState('')
  const definitions = useMemo(
    () => new Map((taches.data ?? []).map((definition) => [definition.id, definition])),
    [taches.data],
  )

  const faites = plan.instances.filter((i) => i.statut === 'faite')
  const partielles = plan.instances.filter((i) => i.statut === 'partielle')
  const nonFaites = plan.instances.filter((i) => i.statut === 'non_faite')
  const nonCochees = plan.instances.filter((i) => i.statut === 'a_faire')

  const listeRestes = [...partielles, ...nonFaites]

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-5 px-4 py-6 pb-28">
      <h1 className="text-2xl font-bold text-slate-900">{t('cloture.titre')}</h1>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <p className="text-lg font-semibold text-emerald-700">
          ✓ {t('cloture.faites', { count: faites.length })}
        </p>
        {partielles.length > 0 && (
          <p className="mt-1 text-lg font-semibold text-amber-700">
            ½ {t('cloture.partielles', { count: partielles.length })}
          </p>
        )}
        {nonFaites.length > 0 && (
          <p className="mt-1 text-lg font-semibold text-slate-600">
            ✕ {t('cloture.nonFaites', { count: nonFaites.length })}
          </p>
        )}
        {nonCochees.length > 0 && (
          <p className="mt-1 text-lg text-slate-500">
            {t('cloture.nonCochees', { count: nonCochees.length })}
          </p>
        )}

        {listeRestes.length > 0 && (
          <ul className="mt-4 space-y-2 border-t border-slate-100 pt-4">
            {listeRestes.map((instance) => (
              <li key={instance.id} className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-slate-800">
                  {libelleInstance(
                    instance,
                    instance.task_definition_id === null
                      ? undefined
                      : definitions.get(instance.task_definition_id),
                    i18n.language,
                  )}
                </span>
                <span className="text-sm text-slate-500">
                  {instance.statut === 'partielle'
                    ? t('plan.statutPartielle')
                    : t('plan.statutNonFaite')}
                  {' · '}
                  {instance.motif_non_faite !== null
                    ? t(`motifs.${instance.motif_non_faite}`)
                    : t('cloture.sansMotif')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <label htmlFor="note" className="mb-2 block font-medium text-slate-700">
          {t('cloture.note')}
        </label>
        <textarea
          id="note"
          value={note}
          onChange={(evenement) => setNote(evenement.target.value)}
          rows={3}
          className="w-full rounded-xl border-2 border-slate-200 p-3 text-slate-800"
        />
      </section>

      <button
        type="button"
        disabled={cloturer.isPending}
        onClick={() =>
          cloturer.mutate(
            {
              interventionId: plan.intervention.id,
              note: note.trim() === '' ? null : note.trim(),
            },
            { onSuccess: onTerminee },
          )
        }
        className="h-16 rounded-2xl bg-emerald-600 text-lg font-bold text-white shadow-md active:bg-emerald-700 disabled:bg-slate-300"
      >
        {t('cloture.terminer')}
      </button>
      <button
        type="button"
        onClick={onRetour}
        className="h-14 rounded-2xl border-2 border-slate-300 font-medium text-slate-700"
      >
        {t('cloture.retourPlan')}
      </button>
    </main>
  )
}
