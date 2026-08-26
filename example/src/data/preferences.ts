/**
 * Предпочтения, живущие в браузере.
 *
 * Ключ и форма объявлены здесь один раз: форма их пишет, а карточка «сохранено
 * в этом браузере» читает, и разъехаться им нельзя.
 */
import type { Environment } from './services'

export const PREFERENCES_KEY = 'granular-status-prefs'

/** Событие окна: правку в этой же вкладке `storage` не эмитит. */
export const PREFERENCES_CHANGED = 'granular-status:preferences'

export type Density = 'compact' | 'cosy' | 'roomy'
export type Notify = 'all' | 'incidents' | 'none'

export type Preferences = {
  env: Environment
  density: Density
  notify: Notify
}

export const defaultPreferences: Preferences = {
  env: 'prod',
  density: 'cosy',
  notify: 'incidents',
}

/** Разбор чужой строки: любое несовпадение — умолчание, а не исключение. */
export function readPreferences(): Preferences | null {
  try {
    const raw = localStorage.getItem(PREFERENCES_KEY)
    if (!raw)
      return null
    const parsed = JSON.parse(raw) as Partial<Preferences>
    return {
      env: parsed.env ?? defaultPreferences.env,
      density: parsed.density ?? defaultPreferences.density,
      notify: parsed.notify ?? defaultPreferences.notify,
    }
  }
  catch {
    // Приватный режим Safari бросает на чтении, испорченный JSON — на разборе.
    // Ни то ни другое не повод ронять страницу.
    return null
  }
}
