import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formaterDateCourte } from '../lib.js'
import type { DefinitionTacheDto, InstanceDto } from '../types.js'

/**
 * Une ligne cochable du plan (SPEC §6) : la zone principale bascule fait /
 * à faire, un chevron déplie la checklist et les instructions, l'icône ✋
 * ouvre le menu « je n'ai pas pu faire ». Cibles tactiles ≥ 56 px.
 */
export function LigneTache({
  instance,
  definition,
  onBasculer,
  onOuvrirMotifs,
}: {
  instance: InstanceDto
  definition: DefinitionTacheDto | undefined
  onBasculer: () => void
  onOuvrirMotifs: () => void
}) {
  const { t, i18n } = useTranslation()
  const [detailOuvert, setDetailOuvert] = useState(false)
  const aDetail =
    definition !== undefined &&
    (definition.checklist.length > 0 || definition.instructions !== null)

  const coche = (() => {
    switch (instance.statut) {
      case 'faite':
        return <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-lg font-bold text-white">✓</span>
      case 'partielle':
        return <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-400 text-sm font-bold text-white">½</span>
      case 'non_faite':
        return <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-300 text-lg font-bold text-white">✕</span>
      default:
        return <span className="h-8 w-8 shrink-0 rounded-full border-[3px] border-slate-300" />
    }
  })()

  return (
    <li className="border-t border-slate-100 first:border-t-0">
      <div className="flex items-stretch">
        <button
          type="button"
          onClick={onBasculer}
          aria-label={t('plan.basculer', { tache: instance.libelle })}
          className="flex min-h-14 flex-1 items-center gap-3 px-4 py-2 text-left active:bg-slate-50"
        >
          {coche}
          <span className="min-w-0 flex-1">
            <span
              className={
                instance.statut === 'faite'
                  ? 'text-slate-400'
                  : instance.statut === 'non_faite'
                    ? 'text-slate-400 line-through'
                    : 'text-slate-800'
              }
            >
              {instance.libelle}
            </span>
            <span className="flex flex-wrap gap-2">
              {instance.reportee_depuis !== null && (
                <span className="mt-1 inline-block rounded-full bg-amber-100 px-2.5 py-0.5 text-sm font-medium text-amber-800">
                  {t('plan.reporteeDepuis', {
                    date: formaterDateCourte(instance.reportee_depuis, i18n.language),
                  })}
                </span>
              )}
              {instance.origine === 'ponctuelle' && (
                <span className="mt-1 inline-block rounded-full bg-sky-100 px-2.5 py-0.5 text-sm font-medium text-sky-800">
                  {t('plan.demande')}
                </span>
              )}
              {(instance.statut === 'partielle' || instance.statut === 'non_faite') &&
                instance.motif_non_faite !== null && (
                  <span className="mt-1 inline-block text-sm text-slate-500">
                    {t(`motifs.${instance.motif_non_faite}`)}
                  </span>
                )}
            </span>
          </span>
        </button>
        {aDetail && (
          <button
            type="button"
            onClick={() => setDetailOuvert((ouvert) => !ouvert)}
            aria-label={t('plan.ouvrirDetail', { tache: instance.libelle })}
            aria-expanded={detailOuvert}
            className="flex h-14 w-14 shrink-0 items-center justify-center self-center text-xl text-slate-400 active:bg-slate-50"
          >
            {detailOuvert ? '▾' : '▸'}
          </button>
        )}
        <button
          type="button"
          onClick={onOuvrirMotifs}
          aria-label={t('plan.ouvrirMotifs', { tache: instance.libelle })}
          className="flex h-14 w-14 shrink-0 items-center justify-center self-center rounded-full text-xl active:bg-slate-50"
        >
          ✋
        </button>
      </div>
      {detailOuvert && aDetail && definition !== undefined && (
        <div className="mx-4 mb-3 rounded-xl bg-slate-50 px-4 py-3 text-slate-600">
          {definition.checklist.length > 0 && (
            <ul className="list-disc space-y-1 pl-5">
              {definition.checklist.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          )}
          {definition.instructions !== null && (
            <p className={`italic ${definition.checklist.length > 0 ? 'mt-2' : ''}`}>
              {definition.instructions}
            </p>
          )}
        </div>
      )}
    </li>
  )
}
