import { useTranslation } from 'react-i18next'
import { useDemarrer, useMessages, useProchaineIntervention } from '../api.js'
import { formaterDateLongue } from '../lib.js'
import type { PlanDuJourDto } from '../types.js'

/**
 * Écran d'accueil (SPEC §6) : la date, le type de passage en clair, un bouton
 * unique « Commencer », et l'encart des messages ou consignes des employeurs.
 */
export function Accueil({
  plan,
  chargement,
  enErreur,
  onReessayer,
  onEntrer,
}: {
  plan: PlanDuJourDto | null
  chargement: boolean
  enErreur: boolean
  onReessayer: () => void
  onEntrer: () => void
}) {
  const { t, i18n } = useTranslation()
  const demarrer = useDemarrer()
  const prochaine = useProchaineIntervention(!chargement && plan === null)
  const messages = useMessages()
  const motsEmployeurs = (messages.data ?? []).filter((m) => m.auteur === 'employeur').slice(-3)

  const contenu = () => {
    if (chargement) {
      return <p className="text-xl text-slate-500">{t('commun.chargement')}</p>
    }
    if (enErreur) {
      return (
        <>
          <p className="text-xl text-slate-600">{t('commun.erreurReseau')}</p>
          <button
            type="button"
            onClick={onReessayer}
            className="mt-6 h-14 rounded-2xl border-2 border-slate-300 px-8 font-semibold text-slate-700"
          >
            {t('commun.reessayer')}
          </button>
        </>
      )
    }
    if (plan === null) {
      return (
        <>
          <p className="text-2xl text-slate-600">{t('accueil.aucuneIntervention')}</p>
          {prochaine.data != null && (
            <p className="mt-3 text-lg text-slate-500">
              {t('accueil.prochaine', {
                date: formaterDateLongue(prochaine.data.date, i18n.language),
              })}
            </p>
          )}
        </>
      )
    }

    const { intervention } = plan
    return (
      <>
        <p className="text-2xl font-semibold text-slate-900 first-letter:uppercase">
          {formaterDateLongue(intervention.date, i18n.language)}
        </p>
        <p className="mt-2 text-xl text-slate-600">{t(`typePassage.${intervention.type}`)}</p>

        {(intervention.note_employeur !== null || motsEmployeurs.length > 0) && (
          <aside className="mt-8 w-full max-w-xl rounded-2xl bg-sky-50 p-5 text-left">
            <h2 className="mb-2 font-semibold text-sky-900">{t('accueil.messagesTitre')}</h2>
            {intervention.note_employeur !== null && (
              <p className="text-sky-950">{intervention.note_employeur}</p>
            )}
            {motsEmployeurs.map((message) => (
              <p key={message.id} className="mt-1 text-sky-950">
                {message.texte}
              </p>
            ))}
          </aside>
        )}

        {intervention.statut === 'cloturee' ? (
          <p className="mt-10 text-xl text-emerald-700">✓ {t('accueil.terminee')}</p>
        ) : (
          <button
            type="button"
            disabled={demarrer.isPending}
            onClick={() => {
              if (intervention.statut === 'en_cours') onEntrer()
              else demarrer.mutate(intervention.id, { onSuccess: onEntrer })
            }}
            className="mt-10 h-16 w-full max-w-md rounded-2xl bg-emerald-600 text-xl font-bold text-white shadow-md active:bg-emerald-700 disabled:bg-slate-300"
          >
            {intervention.statut === 'en_cours' ? t('accueil.reprendre') : t('accueil.commencer')}
          </button>
        )}
      </>
    )
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-10 text-center">
      {contenu()}
    </main>
  )
}
