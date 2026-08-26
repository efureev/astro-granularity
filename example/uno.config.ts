import { granularContent, presetGranularNode, type PresetGranularNodeOptions } from '@feugene/unocss-preset-granular/node'
import granularityProvider from '@feugene/granularity/granular-provider/node'
import { defineConfig, presetMini } from 'unocss'

/**
 * Один и тот же объект уходит и в `granularContent`, и в `presetGranularNode`:
 * первое задаёт, что сканировать, второе — что эмитить. Разъедутся — компоненты
 * приедут бесцветными.
 */
const options: PresetGranularNodeOptions = {
  providers: [granularityProvider],
  // Список, а не `'all'`: пресет сам дотягивает транзитивные зависимости
  // (`GrDialog` → `GrModal`, `GrSelect` → чипы), а `'all'` эмитит CSS всех
  // 78 компонентов ядра — сто с лишним килобайт, блокирующих первую отрисовку.
  components: [{
    provider: '@feugene/granularity',
    names: ['GrButton', 'GrCard', 'GrDialog', 'GrTooltip', 'GrSelect'],
  }],
  themes: { names: ['light', 'dark'] },
  layer: 'granular',
}

export default defineConfig({
  content: granularContent(options),
  presets: [presetMini(), presetGranularNode(options)],
})
