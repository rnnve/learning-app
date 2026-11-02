import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./en.json";
import th from "./th.json";

export const defaultNS = "common";
export const resources = {
  th,
  en,
} as const;

// i18next only treats the prefix of "namespace.key" as a namespace when that
// namespace is listed in `ns`. Without this every lookup would fall back to
// the "translation" namespace and render the raw key.
export const namespaces = Object.keys(th) as string[];

i18n.use(initReactI18next).init({
  compatibilityJSON: "v4",
  resources,
  ns: namespaces,
  defaultNS,
  // i18next v24 defaults nsSeparator to ":"; this project uses the
  // "namespace.key" convention everywhere, so it is set back to ".".
  nsSeparator: ".",
  keySeparator: ".",
  lng: "th", // Thai is ALWAYS the default
  fallbackLng: "th",
  interpolation: {
    escapeValue: false,
    prefix: "%{",
    suffix: "}",
  },
});

export default i18n;
