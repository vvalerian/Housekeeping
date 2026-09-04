/**
 * Client de l'API + hooks TanStack Query de l'espace employeur.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  CompteDto,
  DemandeDto,
  DetailInterventionDto,
  EtatAuthDto,
  InterventionDto,
  MessageDto,
  PieceDto,
  ProduitDto,
  RotationDto,
  SignalementDto,
  TacheDto,
} from './types.js'

export class ErreurApi extends Error {
  constructor(
    public statut: number,
    public detail: string,
  ) {
    super(detail)
  }
}

async function requete<T>(chemin: string, options: RequestInit = {}): Promise<T> {
  const reponse = await fetch(`/api${chemin}`, {
    ...options,
    headers: options.body === undefined ? undefined : { 'content-type': 'application/json' },
  })
  if (!reponse.ok) {
    const corps = (await reponse.json().catch(() => null)) as { erreur?: string } | null
    throw new ErreurApi(reponse.status, corps?.erreur ?? `Erreur ${reponse.status}`)
  }
  return reponse.json() as Promise<T>
}

function useListe<T>(cle: string, chemin: string) {
  return useQuery({ queryKey: [cle], queryFn: () => requete<T>(chemin) })
}

/** Mutation JSON qui invalide des clés de cache au retour. */
function useAction<TVariables, TResultat = unknown>(
  fabrique: (variables: TVariables) => { chemin: string; methode?: string; corps?: unknown },
  clesAInvalider: string[],
) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (variables: TVariables) => {
      const { chemin, methode = 'POST', corps } = fabrique(variables)
      return requete<TResultat>(chemin, {
        method: methode,
        ...(corps !== undefined ? { body: JSON.stringify(corps) } : {}),
      })
    },
    onSuccess: () => {
      for (const cle of clesAInvalider) void useQueryClientInvalide(client, cle)
    },
  })
}

function useQueryClientInvalide(client: ReturnType<typeof useQueryClient>, cle: string) {
  return client.invalidateQueries({ queryKey: [cle] })
}

// --- Authentification -------------------------------------------------------

export function useEtatAuth() {
  return useQuery({ queryKey: ['auth'], queryFn: () => requete<EtatAuthDto>('/auth/etat') })
}
export const useConnexion = () =>
  useAction<{ identifiant: string; mot_de_passe: string }>(
    (corps) => ({ chemin: '/auth/connexion', corps }),
    ['auth'],
  )
export const useInitialisation = () =>
  useAction<{ identifiant: string; mot_de_passe: string }>(
    (corps) => ({ chemin: '/auth/initialisation', corps }),
    ['auth'],
  )
export const useDeconnexion = () => useAction<void>(() => ({ chemin: '/auth/deconnexion' }), ['auth'])
export const useConfigurerPin = () =>
  useAction<string | null>((pin) => ({ chemin: '/auth/pin-tablette', corps: { pin } }), ['auth'])
export const useComptes = () => useListe<CompteDto[]>('comptes', '/auth/comptes')
export const useCreerCompte = () =>
  useAction<{ identifiant: string; mot_de_passe: string }>(
    (corps) => ({ chemin: '/auth/comptes', corps }),
    ['comptes'],
  )

// --- Configuration ----------------------------------------------------------

export const usePieces = () => useListe<PieceDto[]>('pieces', '/pieces')
export const useModifierPiece = () =>
  useAction<{ id: string; corps: Partial<Omit<PieceDto, 'id'>> }>(
    ({ id, corps }) => ({ chemin: `/pieces/${id}`, methode: 'PATCH', corps }),
    ['pieces'],
  )
export const useCreerPiece = () =>
  useAction<{ nom: string; type: PieceDto['type']; surface_m2?: number | null }>(
    (corps) => ({ chemin: '/pieces', corps }),
    ['pieces'],
  )
export const useModeTravaux = () =>
  useAction<{ piece_ids: string[]; debut: string; fin?: string | null; motif?: string }>(
    (corps) => ({ chemin: '/pieces/mode-travaux', corps }),
    ['pieces'],
  )
export const useReactiverPiece = () =>
  useAction<{ id: string; fin?: string }>(
    ({ id, fin }) => ({ chemin: `/pieces/${id}/reactiver`, corps: fin === undefined ? {} : { fin } }),
    ['pieces'],
  )

export const useTaches = () => useListe<TacheDto[]>('taches', '/taches')
export const useModifierTache = () =>
  useAction<{ id: string; corps: Partial<Omit<TacheDto, 'id'>> }>(
    ({ id, corps }) => ({ chemin: `/taches/${id}`, methode: 'PATCH', corps }),
    ['taches'],
  )
export const useCreerTache = () =>
  useAction<Partial<Omit<TacheDto, 'id' | 'actif'>> & { libelle: string; cadence: TacheDto['cadence'] }>(
    (corps) => ({ chemin: '/taches', corps }),
    ['taches'],
  )

// --- Calendrier et interventions --------------------------------------------

export function useInterventions() {
  return useQuery({
    queryKey: ['interventions'],
    queryFn: () => requete<InterventionDto[]>('/interventions'),
  })
}
export function useIntervention(id: string) {
  return useQuery({
    queryKey: ['intervention', id],
    queryFn: () => requete<DetailInterventionDto>(`/interventions/${id}`),
  })
}
export const useGenererCalendrier = () =>
  useAction<{ depuis: string; jusqua: string }>(
    (corps) => ({ chemin: '/calendrier/generer', corps }),
    ['interventions'],
  )
export const useCreerIntervention = () =>
  useAction<{ date: string; type: InterventionDto['type'] }>(
    (corps) => ({ chemin: '/interventions', corps }),
    ['interventions'],
  )
export const useAnnulerIntervention = () =>
  useAction<string>((id) => ({ chemin: `/interventions/${id}/annuler` }), ['interventions'])
export const useModifierIntervention = () =>
  useAction<{ id: string; corps: { date?: string; note_employeur?: string | null } }>(
    ({ id, corps }) => ({ chemin: `/interventions/${id}`, methode: 'PATCH', corps }),
    ['interventions'],
  )

export const useRotations = () => useListe<RotationDto[]>('rotations', '/rotations/etat')

// --- Échanges ---------------------------------------------------------------

export const useDemandes = () => useListe<DemandeDto[]>('demandes', '/demandes')
export const useCreerDemande = () =>
  useAction<{ texte: string; intervention_id?: string | null }>(
    (corps) => ({ chemin: '/demandes', corps }),
    ['demandes'],
  )
export const useModifierDemande = () =>
  useAction<{ id: string; corps: { texte?: string; statut?: 'en_attente' | 'annulee' } }>(
    ({ id, corps }) => ({ chemin: `/demandes/${id}`, methode: 'PATCH', corps }),
    ['demandes'],
  )

export const useSignalements = () => useListe<SignalementDto[]>('signalements', '/signalements')
export const useModifierSignalement = () =>
  useAction<{ id: string; corps: { statut?: 'ouvert' | 'traite'; reponse_employeur?: string | null } }>(
    ({ id, corps }) => ({ chemin: `/signalements/${id}`, methode: 'PATCH', corps }),
    ['signalements'],
  )

export const useProduits = () => useListe<ProduitDto[]>('produits', '/produits')
export const useCreerProduit = () =>
  useAction<{ nom: string }>((corps) => ({ chemin: '/produits', corps }), ['produits'])
export const useModifierProduit = () =>
  useAction<{ id: string; niveau: ProduitDto['niveau'] }>(
    ({ id, niveau }) => ({ chemin: `/produits/${id}`, methode: 'PATCH', corps: { niveau } }),
    ['produits'],
  )

export const useMessages = () => useListe<MessageDto[]>('messages', '/messages')
export const useEnvoyerMessage = () =>
  useAction<string>((texte) => ({ chemin: '/messages', corps: { auteur: 'employeur', texte } }), [
    'messages',
  ])
