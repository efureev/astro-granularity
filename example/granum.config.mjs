// @ts-check
import { windEngine } from '@feugene/granum-engine-wind'
import { defineGranumConfig } from '@feugene/granum/vite'

/**
 * Список компонентов, а не `'all'`, — и первая причина не про вес.
 *
 * При явной селекции работает guard импортов: `import { GrTable } from
 * '@feugene/granularity/components/GrTable'` роняет сборку, пока `GrTable` не
 * назван здесь. При `'all'` guard не может сказать ничего — а этот пример и
 * существует как образец покомпонентной установки.
 *
 * Вес — вторая причина: все компоненты ядра стоят вдвое дороже девяти. Про
 * транзитивные зависимости (`GrDialog` → `GrModal`, `GrSelect` → чипы) думать
 * не надо: granum замыкает селекцию по манифесту сам.
 */
export default defineGranumConfig({
  engine: windEngine(),
  providers: ['@feugene/granularity', '@feugene/granularity-chrono'],
  components: [
    {
      provider: '@feugene/granularity',
      names: ['GrButton', 'GrCard', 'GrDialog', 'GrForm', 'GrFormField', 'GrInput', 'GrSelect', 'GrTooltip'],
    },
    { provider: '@feugene/granularity-chrono', names: ['GrDatePicker'] },
  ],
  themes: { names: ['light', 'dark'] },
  /*
   * Классы разметки приложения берутся с диска. Это закрывает дыру, которая у
   * пресета v1 лечилась ручной строкой в `content.filesystem`: класс, живущий
   * только внутри острова `client:only`, в CSS не попадал вовсе — такой остров
   * не участвует в серверной сборке, а к клиентской стили уже собраны.
   */
  appSources: { dirs: ['src'] },
})
