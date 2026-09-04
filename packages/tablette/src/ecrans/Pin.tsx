import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ErreurApi, useConnexionPin, useEtatAuth } from '../api.js'

/**
 * Verrou de la tablette (SPEC §2) : code PIN à 4 chiffres sur pavé tactile.
 * Si le PIN est désactivé en configuration, la session s'ouvre toute seule ;
 * s'il n'est pas encore configuré, la tablette attend l'espace employeur.
 */
export function Pin({ etat }: { etat: 'non_configure' | 'requis' | 'desactive' }) {
  const { t } = useTranslation()
  const etatAuth = useEtatAuth()
  const connexion = useConnexionPin()
  const [saisie, setSaisie] = useState('')

  // PIN désactivé : ouverture automatique de la session tablette.
  useEffect(() => {
    if (etat === 'desactive' && connexion.isIdle) connexion.mutate(null)
  }, [etat, connexion])

  useEffect(() => {
    if (saisie.length === 4 && !connexion.isPending) {
      connexion.mutate(saisie, { onSettled: () => setSaisie('') })
    }
  }, [saisie, connexion])

  if (etat === 'desactive') {
    return (
      <main className="flex min-h-dvh items-center justify-center px-6">
        <p className="text-xl text-slate-500">{t('pin.connexion')}</p>
      </main>
    )
  }

  if (etat === 'non_configure') {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
        <p className="text-5xl" aria-hidden="true">
          🔒
        </p>
        <p className="mt-4 max-w-xl text-xl text-slate-600">{t('pin.nonConfigure')}</p>
        <button
          type="button"
          onClick={() => void etatAuth.refetch()}
          className="mt-8 h-14 rounded-2xl border-2 border-slate-300 px-8 font-semibold text-slate-700"
        >
          {t('pin.verifier')}
        </button>
      </main>
    )
  }

  const erreur =
    connexion.error instanceof ErreurApi
      ? connexion.error.statut === 429
        ? t('pin.verrou')
        : t('pin.erreur')
      : null

  const touche = (valeur: string) => (
    <button
      key={valeur}
      type="button"
      onClick={() => setSaisie((s) => (s.length < 4 ? s + valeur : s))}
      className="h-16 rounded-2xl bg-white text-2xl font-semibold text-slate-800 shadow-sm active:bg-slate-100"
    >
      {valeur}
    </button>
  )

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-8">
      <h1 className="text-2xl font-bold text-slate-900">{t('pin.titre')}</h1>
      <p className="mt-1 text-slate-500">{t('pin.sousTitre')}</p>

      <div className="mt-6 flex gap-4" aria-hidden="true">
        {[0, 1, 2, 3].map((position) => (
          <span
            key={position}
            className={`h-5 w-5 rounded-full ${
              position < saisie.length ? 'bg-slate-800' : 'border-2 border-slate-300'
            }`}
          />
        ))}
      </div>

      {erreur !== null && saisie.length === 0 && (
        <p role="alert" className="mt-4 font-medium text-red-600">
          {erreur}
        </p>
      )}

      <div className="mt-8 grid w-full max-w-xs grid-cols-3 gap-3">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(touche)}
        <span />
        {touche('0')}
        <button
          type="button"
          onClick={() => setSaisie((s) => s.slice(0, -1))}
          aria-label={t('pin.effacer')}
          className="h-16 rounded-2xl text-2xl text-slate-500 active:bg-slate-100"
        >
          ⌫
        </button>
      </div>
    </main>
  )
}
