import { granularContent, presetGranularNode, type PresetGranularNodeOptions } from '@feugene/unocss-preset-granular/node'
import chronoProvider from '@feugene/granularity-chrono/granular-provider/node'
import granularityProvider from '@feugene/granularity/granular-provider/node'
import { defineConfig, presetMini } from 'unocss'

/**
 * Один и тот же объект уходит и в `granularContent`, и в `presetGranularNode`:
 * первое задаёт, что сканировать, второе — что эмитить. Разъедутся — компоненты
 * приедут бесцветными.
 */
const options: PresetGranularNodeOptions = {
  providers: [granularityProvider, chronoProvider],
  // Список, а не `'all'`: пресет сам дотягивает транзитивные зависимости
  // (`GrDialog` → `GrModal`, `GrSelect` → чипы), а `'all'` эмитит CSS всех
  // 78 компонентов ядра — сто с лишним килобайт, блокирующих первую отрисовку.
  components: [
    { provider: '@feugene/granularity', names: ['GrButton', 'GrCard', 'GrDialog', 'GrTooltip', 'GrSelect', 'GrForm', 'GrFormField', 'GrInput'] },
    { provider: '@feugene/granularity-chrono', names: ['GrDatePicker'] },
  ],
  themes: { names: ['light', 'dark'] },
  layer: 'granular',
}

const content = granularContent(options)

export default defineConfig({
  content: {
    ...content,
    /**
     * Свои исходники — с диска, а не только через конвейер трансформаций.
     *
     * Без этой строки классы, встречающиеся **только** внутри острова
     * `client:only`, в CSS не попадают вовсе: такой остров не участвует в
     * серверной сборке, а к клиентской стили уже собраны. Остров приезжает
     * без стилей, и ни ошибки, ни предупреждения при этом нет.
     */
    filesystem: [...(content.filesystem ?? []), 'src/**/*.{vue,astro,ts}'],
  },
  presets: [presetMini(), presetGranularNode(options)],
})
