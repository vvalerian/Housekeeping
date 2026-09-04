/**
 * SPEC §6 : i18next dès le premier écran, extraction complète des chaînes.
 * La langue est un paramètre de l'appareil (détection navigateur), pas de
 * l'application. Choix du foyer (2026-09-04) : français uniquement — la
 * structure est prête si une locale devait s'ajouter.
 */
import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'
import fr from './locales/fr.json'

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { fr: { translation: fr } },
    fallbackLng: 'fr',
    interpolation: { escapeValue: false },
    detection: { order: ['navigator'], caches: [] },
  })

export default i18n
