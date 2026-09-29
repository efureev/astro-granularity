import { expect, test } from '@playwright/test'
import { PORTS } from '../playwright.config'

/**
 * Dev обязан выглядеть как собранное приложение.
 *
 * Гейты выше работают по собранному `dist/`, и целый слой дефектов им не виден
 * по построению. Первый же из них стоил дня: Vite не отдаёт файлы выше корня
 * проекта, зависимости стенда лежат этажом выше — и в dev ни один остров не
 * гидратировался, отвечая `403` на `/@fs/…`. CSS при этом приезжал нормально,
 * так что поломка выглядела как «всё на месте, только ничего не нажимается».
 * `astro build` про `/@fs/` не знает вовсе, поэтому e2e молчал.
 *
 * Разметка dev и сборки совпадать не может и не должна: в dev модули не
 * собраны, к ним добавлен HMR-клиент. Сравнивается то, что видит пользователь:
 * вычисленные стили, текст и работающая гидратация.
 */
const DEV = `http://localhost:${PORTS.dev}`
const BUILT = `http://localhost:${PORTS.static}`

/** Вычисленный вид ключевых элементов страницы — то, что видно глазами. */
const LOOK = `() => {
  const pick = (el) => {
    if (!el) return null
    const s = getComputedStyle(el)
    return {
      color: s.color,
      background: s.backgroundColor,
      font: \`\${s.fontSize}/\${s.lineHeight} \${s.fontWeight}\`,
      padding: s.padding,
      radius: s.borderRadius,
      // innerText, а не textContent: второй несёт и содержимое инлайновых
      // скриптов, а они в dev и в сборке разные — к виду это отношения не имеет.
      text: (el.innerText ?? '').trim().slice(0, 40),
    }
  }
  return {
    body: pick(document.body),
    h1: pick(document.querySelector('h1')),
    button: pick(document.querySelector('[data-testid=pref-save]')),
    card: pick(document.querySelector('[class*=rounded]')),
    theme: document.documentElement.dataset.theme,
  }
}`

async function look(page: import('@playwright/test').Page, origin: string): Promise<unknown> {
  await page.goto(`${origin}/settings/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  // eslint-disable-next-line no-eval
  return page.evaluate(`(${LOOK})()`)
}

/*
 * Прогон по dev-серверу идёт последовательно и после прогрева.
 *
 * Vite досканирует зависимости на ПЕРВОЙ загрузке страницы браузером — не
 * раньше: пока модули никто не исполнял, обнаруживать нечего. Запросы, попавшие
 * в эту пересборку, получают `504 Outdated Optimize Dep`, и холодный старт
 * ронял бы гейт на гонке вместо дефекта. Настоящая поломка (например `403` на
 * `/@fs/`) прогрев переживает — она не про тайминг.
 */
test.describe.configure({ mode: 'serial' })

test.describe('dev выглядит как сборка', () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage()
    await page.goto(`${DEV}/settings/`, { waitUntil: 'networkidle' }).catch(() => {})
    await page.waitForTimeout(2000)
    await page.reload({ waitUntil: 'networkidle' }).catch(() => {})
    await page.close()
  })

  test('вычисленные стили ключевых элементов совпадают', async ({ browser }) => {
    const devPage = await browser.newPage({ viewport: { width: 1280, height: 900 } })
    const builtPage = await browser.newPage({ viewport: { width: 1280, height: 900 } })

    const [inDev, inBuild] = await Promise.all([look(devPage, DEV), look(builtPage, BUILT)])

    expect(inDev).toEqual(inBuild)

    await devPage.close()
    await builtPage.close()
  })

  test('острова гидратируются и сеть чиста', async ({ page }) => {
    const failures: string[] = []
    page.on('pageerror', error => failures.push(`pageerror: ${String(error).slice(0, 160)}`))
    page.on('response', (response) => {
      // `403` на `/@fs/…` выглядел именно так — и только так.
      if (response.status() >= 400)
        failures.push(`${response.status()} ${response.url().replace(DEV, '').slice(0, 100)}`)
    })

    await page.goto(`${DEV}/settings/`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(700)

    // Гидратация: до неё нажатие ничего не меняет.
    await page.getByTestId('pref-save').click()
    await expect(page.getByRole('status')).toBeVisible()

    expect(failures, 'ошибок страницы и ответов >= 400 быть не должно').toEqual([])
  })
})
