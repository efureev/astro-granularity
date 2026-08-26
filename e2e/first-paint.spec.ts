import { expect, test } from '@playwright/test'
import sharp from 'sharp'

/** Порог «тёмного»: сумма RGB. Наш тёмный фон — #101014, светлый — #ffffff. */
const DARK_MAX = 200
const LIGHT_MIN = 600

async function topLeftPixel(pngBase64: string): Promise<[number, number, number]> {
  const { data } = await sharp(Buffer.from(pngBase64, 'base64'))
    .extract({ left: 0, top: 0, width: 1, height: 1 })
    .raw()
    .toBuffer({ resolveWithObject: true })
  return [data[0]!, data[1]!, data[2]!]
}

/**
 * Снимает каждый кадр отрисовки во время навигации.
 *
 * Скриншот после `goto` показал бы уже установившуюся тему и мигание пропустил:
 * оно живёт в кадрах между первой отрисовкой и исполнением скрипта. Их и ловим.
 */
async function captureFrames(page: import('@playwright/test').Page, url: string): Promise<string[]> {
  const client = await page.context().newCDPSession(page)
  const frames: string[] = []

  client.on('Page.screencastFrame', (payload: { data: string, sessionId: number }) => {
    frames.push(payload.data)
    void client.send('Page.screencastFrameAck', { sessionId: payload.sessionId }).catch(() => {})
  })

  // `Page.enable` обязателен: без него события домена Page не приходят вовсе,
  // и скринкаст молча отдаёт ноль кадров — тест «проходит» ни на чём.
  await client.send('Page.enable')
  // Замедление процессора расширяет окно, в котором мигание видно. На быстрой
  // локальной странице настоящий дефект уложился бы между двумя кадрами и
  // остался бы незамеченным.
  await client.send('Emulation.setCPUThrottlingRate', { rate: 6 })
  await client.send('Page.startScreencast', { format: 'png', everyNthFrame: 1 })

  await page.goto(url, { waitUntil: 'load' })
  await page.waitForTimeout(400)

  await client.send('Page.stopScreencast')
  await client.send('Emulation.setCPUThrottlingRate', { rate: 1 })
  await client.detach()
  return frames
}

test.describe('первый кадр', () => {
  test('на тёмной системе ни один кадр не приезжает светлым', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-dark', 'проект светлой темы проверяет обратное')

    const frames = await captureFrames(page, '/')
    expect(frames.length, 'скринкаст не отдал ни одного кадра').toBeGreaterThan(0)

    for (const [index, frame] of frames.entries()) {
      const [r, g, b] = await topLeftPixel(frame)
      expect(
        r + g + b,
        `кадр ${index + 1} из ${frames.length} светлый: rgb(${r}, ${g}, ${b}). `
        + 'Скрипт темы отработал после первой отрисовки — это и есть мигание.',
      ).toBeLessThan(DARK_MAX)
    }
  })

  test('на светлой системе ни один кадр не приезжает тёмным', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-light', 'проект тёмной темы проверяет обратное')

    const frames = await captureFrames(page, '/')
    expect(frames.length).toBeGreaterThan(0)

    for (const [index, frame] of frames.entries()) {
      const [r, g, b] = await topLeftPixel(frame)
      expect(r + g + b, `кадр ${index + 1} тёмный: rgb(${r}, ${g}, ${b})`).toBeGreaterThan(LIGHT_MIN)
    }
  })
})

test.describe('форма скрипта', () => {
  test('инлайн, синхронный и в `<head>`', async ({ page }) => {
    await page.goto('/')

    const shape = await page.evaluate(() => {
      const scripts = [...document.head.querySelectorAll('script')]
      const themeScript = scripts.find(s => s.textContent?.includes('prefers-color-scheme'))
      if (!themeScript)
        return null
      return {
        inHead: themeScript.parentElement?.tagName === 'HEAD',
        inline: themeScript.src === '',
        sync: !themeScript.defer && !themeScript.async,
        bytes: themeScript.textContent?.length ?? 0,
      }
    })

    // Внешний файл, `defer` или `async` — каждое возвращает мигание,
    // и ни одно не видно в юнит-тестах.
    expect(shape, 'скрипт темы не найден в <head>').not.toBeNull()
    expect(shape!.inHead).toBe(true)
    expect(shape!.inline).toBe(true)
    expect(shape!.sync).toBe(true)
    expect(shape!.bytes).toBeLessThanOrEqual(512)
  })
})

test.describe('переключатель', () => {
  test('меняет тему, сохраняет выбор и правит доступное имя', async ({ page }) => {
    await page.goto('/')
    const button = page.locator('[data-gr-theme-toggle]')
    const before = await page.evaluate(() => document.documentElement.dataset.theme)

    await button.click()

    const after = await page.evaluate(() => document.documentElement.dataset.theme)
    expect(after).not.toBe(before)
    expect(await page.evaluate(() => localStorage.getItem('gr-theme'))).toBe(after)
    expect(await page.evaluate(() => document.documentElement.style.colorScheme)).toBe(after)
    // Имя описывает результат нажатия, значит после переключения оно обязано измениться.
    expect(await button.getAttribute('aria-label')).toContain(before === 'dark' ? 'dark' : 'light')
  })

  test('выбор переживает перезагрузку без мигания', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-light', 'достаточно одного проекта')

    await page.goto('/')
    await page.locator('[data-gr-theme-toggle]').click()
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark')

    const frames = await captureFrames(page, '/')
    for (const frame of frames) {
      const [r, g, b] = await topLeftPixel(frame)
      expect(r + g + b, 'сохранённая тёмная тема мигнула светлым при перезагрузке').toBeLessThan(DARK_MAX)
    }
  })
})

test.describe('остров', () => {
  test('`GrButton` гидратируется и приезжает в цвете', async ({ page }) => {
    await page.goto('/')
    const button = page.locator('[data-testid="island"] button')
    await expect(button).toBeVisible()

    // Цвет — главное. Бесцветная кнопка означает, что UnoCSS не просканировал
    // `dist` библиотеки, и это самый частый способ собрать портал молча сломанным.
    const background = await button.evaluate(el => getComputedStyle(el).backgroundColor)
    expect(background).not.toBe('rgba(0, 0, 0, 0)')
    expect(background).not.toBe('transparent')

    await button.click()
    await expect(button).toContainText('Clicked 1')
  })

  test('строки приезжают на языке страницы, а не ключами', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-light', 'достаточно одного проекта')

    // Язык берётся из `<html lang>` страницы `/ru/`, а не из настроек Astro:
    // на статической сборке это единственный источник, знающий локаль маршрута.
    await page.goto('/ru/')

    // Ретраящийся ассерт обязателен: блок грузится асинхронно, и до его прихода
    // `t()` синхронно отдаёт сам ключ. Проверка на «нет ошибок в консоли»
    // прошла бы и при полностью отключённом i18n — эта не пройдёт.
    await expect(page.getByTestId('locale-demo')).toContainText('Назад')
    await expect(page.getByTestId('locale-demo')).toContainText('Вперёд')
    // Английского на русской странице быть не должно: иначе блок не доехал
    // и виден fallback.
    await expect(page.getByTestId('locale-demo')).not.toContainText('Prev')
  })
})
