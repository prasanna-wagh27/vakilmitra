import type { Locale } from "@vakilmitra/shared";
import { interpolate, type MessageKey, translate } from "@vakilmitra/shared/i18n";
import { useCallback, useEffect } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type { MessageKey };

interface LocaleState {
  locale: Locale;
  chosen: boolean; // the viewer picked a language on this device
  setLocale: (l: Locale, chosen?: boolean) => void;
}

/** Marathi by default; the choice is remembered per device. */
export const useLocaleStore = create<LocaleState>()(
  persist(
    (set) => ({
      locale: "mr",
      chosen: false,
      setLocale: (locale, chosen = true) => set({ locale, chosen }),
    }),
    { name: "vm_locale", storage: createJSONStorage(() => localStorage) },
  ),
);

export function useI18n() {
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);
  const t = useCallback((key: MessageKey) => translate(locale, key), [locale]);
  const tf = useCallback((key: MessageKey, vars: Record<string, string | number>) => interpolate(translate(locale, key), vars), [locale]);
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return { locale, setLocale, t, tf };
}
