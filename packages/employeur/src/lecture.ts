/**
 * Mode lecture seule : un compte `observateur` (société de prestation) voit
 * tout l'espace sauf la page Sécurité, sans aucun contrôle d'édition — le
 * serveur refuse de toute façon ses écritures (403), l'interface se contente
 * de ne pas les proposer.
 */
import { createContext, useContext } from 'react'

export const ContexteLectureSeule = createContext(false)

export function useLectureSeule(): boolean {
  return useContext(ContexteLectureSeule)
}
