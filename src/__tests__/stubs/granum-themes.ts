/** Манифест сборки с темой и режимом, которых нет в запасном манифесте ядра. */
export default {
  theme: { id: 'brand', title: 'Brand' },
  modes: [
    { name: 'light', colorScheme: 'light', value: 'brand-light' },
    { name: 'ocean', colorScheme: 'dark', value: 'brand-ocean' },
  ],
  defaultMode: 'light',
  activation: { attribute: 'data-theme', value: '{theme}-{mode}' },
}
