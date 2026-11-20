import type { Locale } from "@vakilmitra/shared";
import { interpolate, type MessageKey, translate } from "@vakilmitra/shared/i18n";
import { useCallback, useEffect } from "react";
import { z } from "zod";
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

// Form checks without a message of their own get one in the reader's language (zod's defaults are English).
z.config({
  customError: (iss) => {
    const key: MessageKey =
      iss.code === "invalid_format" && iss.format === "email"
        ? "common.invalidEmail"
        : iss.code === "too_small"
          ? iss.minimum === 1
            ? "common.required"
            : "common.tooShort"
          : iss.code === "too_big"
            ? "common.tooLong"
            : iss.code === "invalid_type"
              ? "common.required"
              : "common.invalid";
    return translate(useLocaleStore.getState().locale, key);
  },
});
