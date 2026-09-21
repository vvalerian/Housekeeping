/**
 * SPEC §6 : i18next dès le premier écran, extraction complète des chaînes.
 * La langue est un paramètre de l'appareil (détection navigateur), pas de
 * l'application. Langues du foyer : français et portugais brésilien (la
 * langue de l'intervenante, confirmée le 2026-09-21) — un appareil en
 * `pt`/`pt-BR` reçoit l'interface ET le catalogue en portugais, tout autre
 * réglage retombe sur le français.
 */
import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'
import fr from './locales/fr.json'
import pt from './locales/pt.json'

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { fr: { translation: fr }, pt: { translation: pt } },
    fallbackLng: 'fr',
    supportedLngs: ['fr', 'pt'],
    load: 'languageOnly', // pt-BR → pt
    interpolation: { escapeValue: false },
    detection: { order: ['navigator'], caches: [] },
  })

export default i18n
