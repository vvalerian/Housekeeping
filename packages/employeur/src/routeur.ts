/**
 * Routage par fragment (#/pieces, #/interventions/<id>…) : suffisant pour une
 * SPA servie sous /admin, sans dépendance.
 */
import { useEffect, useState } from 'react'

export function useRoute(): string {
  const [route, setRoute] = useState(() => window.location.hash.slice(1) || '/')
  useEffect(() => {
    const surChangement = () => setRoute(window.location.hash.slice(1) || '/')
    window.addEventListener('hashchange', surChangement)
    return () => window.removeEventListener('hashchange', surChangement)
  }, [])
  return route
}

export function naviguer(chemin: string): void {
  window.location.hash = chemin
}
