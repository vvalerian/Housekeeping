import { useEffect } from 'react'

/**
 * SPEC §6 : écran maintenu allumé pendant une intervention en cours.
 * Wake Lock API quand le navigateur la propose (silencieux sinon — le mode
 * kiosque du lot 4 prendra le relais sur la tablette réelle).
 */
export function useEcranAllume(actif: boolean): void {
  useEffect(() => {
    if (!actif || !('wakeLock' in navigator)) return
    let verrou: WakeLockSentinel | null = null
    let abandonne = false

    const acquerir = async () => {
      try {
        verrou = await navigator.wakeLock.request('screen')
        if (abandonne) await verrou.release()
      } catch {
        // Refusé (économie d'énergie, onglet caché…) : rien à faire.
      }
    }

    void acquerir()
    const surVisibilite = () => {
      if (document.visibilityState === 'visible') void acquerir()
    }
    document.addEventListener('visibilitychange', surVisibilite)
    return () => {
      abandonne = true
      document.removeEventListener('visibilitychange', surVisibilite)
      void verrou?.release()
    }
  }, [actif])
}
