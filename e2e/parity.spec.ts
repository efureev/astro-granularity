import { expect, test } from '@playwright/test'
import sharp from 'sharp'
import { PORTS } from '../playwright.config'

/**
 * Три стенда — один UI.
 *
 * `examples/{static,ssr,hybrid}` делят весь вид: лейауты, компоненты, стили,
 * данные и строки лежат в `examples/shared`, а у стендов своё только
 * `astro.config.mjs`, `granum.config.mjs` и тонкие обёртки маршрутов. Значит
 * любое расхождение между ними — это разница режима вывода Astro, и её видно
 * здесь, а не в чужом проекте через полгода.
 *
 * Гейт поймал первое же расхождение, ради которого заводился: после переезда
 * общего UI в соседний каталог `appSources` перестал его видеть, и в CSS
 * недосчитались 89 классов из 613.
 */
const STANDS = {
  static: `http://localhost:${PORTS.static}`,
  ssr: `http://localhost:${PORTS.ssr}`,
  hybrid: `http://localhost:${PORTS.hybrid}`,
} as const

type Stand = keyof typeof STANDS

const PAGES = ['/', '/ru/', '/settings/', '/incidents/queue-degradation/', '/ru/incidents/queue-degradation/']

/**
 * Что нормализуется перед сравнением разметки — и почему это не поблажка.
 *
 * 1. Хеши ассетов: у каждого стенда свой бандл, имена файлов совпадать не
 *    обязаны. Сравнивается разметка, а не имена.
 * 2. Адрес сайта: `site` у стендов свой, он уезжает в canonical и og.
 * 3. Картинки: под адаптером Astro оптимизирует их на запрос
 *    (`/_image?href=…`), а статика — на сборке (готовый `.webp`). Это
 *    свойство режима, а не разницы приложений; картинка одна и та же.
 * 4. `uid` островов: идентификатор рендера, которым Astro связывает разметку
 *    острова с его гидратацией. На вид он не влияет никак, а совпадать между
 *    режимами не обязан.
 */
function normalize(html: string): string {
  return html
    .replace(/https:\/\/(?:ssr|hybrid)\.astro-granularity\.example/g, 'https://astro-granularity.example')
    .replace(/[A-Za-z0-9_-]{8}\.(css|js|webp|png)/g, 'HASH.$1')
    .replace(/<img[^>]*>/g, '<img>')
    .replace(/<source[^>]*>/g, '<source>')
    .replace(/uid="[^"]*"/g, 'uid=""')
}

async function markup(stand: Stand, path: string): Promise<{ status: number, html: string }> {
  const response = await fetch(`${STANDS[stand]}${path}`)
  return { status: response.status, html: normalize(await response.text()) }
}

/** Доля различающихся пикселей двух снимков одного размера. */
async function pixelDiffRatio(a: Buffer, b: Buffer): Promise<number> {
  const [left, right] = await Promise.all([a, b].map(buffer =>
    sharp(buffer).raw().toBuffer({ resolveWithObject: true })))

  expect(right.info.width, 'ширина снимков').toBe(left.info.width)
  expect(right.info.height, 'высота снимков').toBe(left.info.height)

  let differing = 0
  const channels = left.info.channels
  for (let i = 0; i < left.data.length; i += channels) {
    // Порог на канал: сглаживание шрифтов даёт ±1 даже на одинаковой разметке.
    if (Math.abs(left.data[i]! - right.data[i]!) > 2
      || Math.abs(left.data[i + 1]! - right.data[i + 1]!) > 2
      || Math.abs(left.data[i + 2]! - right.data[i + 2]!) > 2) {
      differing++
    }
  }
  return differing / (left.data.length / channels)
}

test.describe('три режима — один вид', () => {
  for (const path of PAGES) {
    test(`разметка ${path} совпадает у всех трёх`, async () => {
      const base = await markup('static', path)
      expect(base.status, `статика отдала ${base.status}`).toBe(200)

      for (const stand of ['ssr', 'hybrid'] as const) {
        const other = await markup(stand, path)
        expect(other.status, `${stand}: статус`).toBe(base.status)

        if (stand === 'ssr') {
          /*
           * Два объявленных расхождения, и оба — следствие одного решения.
           *
           * При `output: 'server'` интеграция не регистрирует middleware снимка
           * строк: состояние страницы в нём модульное, а запросы под адаптером
           * идут параллельно в одном процессе — язык одного попал бы в ответ
           * другого. Отсюда:
           *
           * 1. снимка строк в `<head>` нет;
           * 2. строки ЯДРА на локализованном маршруте приезжают на языке по
           *    умолчанию: локаль страницы объявлял тот же middleware, и без
           *    него `readServerPageLocale()` пуст. Строки приложения при этом
           *    русские — их язык берётся из маршрута самим приложением.
           *
           * Правит это гидратация, то есть уже в браузере. Строки приложения
           * сравниваются наравне со статикой, поэтому подмена здесь узкая:
           * только те места, где ядро подставило свой словарь.
           *
           * У гибрида ничего этого нет: его маршруты обрабатываются по одному,
           * middleware работает, и он сравнивается со статикой без поблажек.
           */
          expect(other.html, 'у SSR снимка строк быть не должно').not.toContain('data-granularity-i18n')

          const CORE_STRINGS = [['Очистить', 'Clear'], ['Поиск…', 'Search…']] as const
          let expected = base.html.replace(/<script type="application\/json" data-granularity-i18n>.*?<\/script>/s, '')
          for (const [translated, fallback] of CORE_STRINGS)
            expected = expected.replaceAll(`"${translated}"`, `"${fallback}"`)

          expect(other.html, `${stand}: разметка`).toBe(expected)
          continue
        }

        expect(other.html, `${stand}: разметка`).toBe(base.html)
      }
    })
  }

  test('страницы выглядят одинаково пиксель в пиксель', async ({ browser }) => {
    /*
     * Снимок, а не только разметка: одинаковый HTML при разном CSS дал бы
     * одинаковый текст и разный вид. Ровно так выглядела бы потеря классов,
     * если бы она задела не разметку, а только стили.
     */
    const shots: Record<string, Buffer> = {}
    for (const [stand, origin] of Object.entries(STANDS)) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
      await page.goto(`${origin}/settings/`, { waitUntil: 'networkidle' })
      await page.waitForTimeout(400)
      shots[stand] = await page.screenshot({ fullPage: true })
      await page.close()
    }

    for (const stand of ['ssr', 'hybrid']) {
      const ratio = await pixelDiffRatio(shots.static!, shots[stand]!)
      expect(ratio, `${stand}: доля различающихся пикселей`).toBeLessThan(0.001)
    }
  })
})
