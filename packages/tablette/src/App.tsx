import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDuJour } from './api.js'
import { BoutonSignaler } from './composants/BoutonSignaler.js'
import { Accueil } from './ecrans/Accueil.js'
import { Cloture } from './ecrans/Cloture.js'
import { PlanDuJour } from './ecrans/PlanDuJour.js'
import { useEcranAllume } from './wakeLock.js'

type Vue = 'accueil' | 'plan' | 'cloture' | 'terminee'

export default function App() {
  const { t } = useTranslation()
  const duJour = useDuJour()
  const [vue, setVue] = useState<Vue>('accueil')
  const plan = duJour.data ?? null

  // SPEC §6 : écran maintenu allumé pendant une intervention en cours.
  useEcranAllume(plan?.intervention.statut === 'en_cours')

  // Si le plan disparaît (changement de jour, annulation), retour à l'accueil.
  useEffect(() => {
    if (plan === null && vue !== 'accueil') setVue('accueil')
  }, [plan, vue])

  const ecran = () => {
    if (vue === 'plan' && plan !== null) {
      return <PlanDuJour plan={plan} onCloturer={() => setVue('cloture')} />
    }
    if (vue === 'cloture' && plan !== null) {
      return (
        <Cloture
          plan={plan}
          onRetour={() => setVue('plan')}
          onTerminee={() => setVue('terminee')}
        />
      )
    }
    if (vue === 'terminee') {
      return (
        <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
          <p className="text-5xl" aria-hidden="true">
            ✅
          </p>
          <h1 className="mt-4 text-2xl font-bold text-slate-900">{t('terminee.titre')}</h1>
          <p className="mt-2 text-xl text-slate-600">{t('terminee.merci')}</p>
          <button
            type="button"
            onClick={() => setVue('accueil')}
            className="mt-10 h-14 rounded-2xl border-2 border-slate-300 px-8 font-semibold text-slate-700"
          >
            {t('terminee.retour')}
          </button>
        </main>
      )
    }
    return (
      <Accueil
        plan={plan}
        chargement={duJour.isPending}
        enErreur={duJour.isError}
        onReessayer={() => void duJour.refetch()}
        onEntrer={() => setVue('plan')}
      />
    )
  }

  return (
    <>
      {ecran()}
      <BoutonSignaler interventionId={plan?.intervention.id ?? null} />
    </>
  )
}
