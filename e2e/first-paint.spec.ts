import { expect, test } from '@playwright/test'
import sharp from 'sharp'

/** Порог «тёмного»: сумма RGB. Канва примера — #0f172a (80) и #f8fafc (750). */
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

    // Выбор записывается напрямую, а не кликом по переключателю: проверяется
    // инлайн-скрипт **пакета**, и зависимость от разметки примера сделала бы
    // этот гейт заложником чужой кнопки.
    await page.goto('/')
    await page.evaluate(() => localStorage.setItem('gr-theme', 'dark'))

    // Переход до начала съёмки обязателен: скринкаст ловит и кадры уходящей
    // страницы, а она после одной лишь записи в хранилище осталась бы светлой —
    // тест упал бы на собственной подготовке, а не на мигании.
    await page.goto('/')
    expect(
      await page.evaluate(() => document.documentElement.dataset.theme),
      'сохранённая тема не применилась: скрипт темы не вставлен или не отработал',
    ).toBe('dark')

    const frames = await captureFrames(page, '/')
    for (const frame of frames) {
      const [r, g, b] = await topLeftPixel(frame)
      expect(r + g + b, 'сохранённая тёмная тема мигнула светлым при перезагрузке').toBeLessThan(DARK_MAX)
    }
  })
})

/**
 * Клиентская навигация `ClientRouter`.
 *
 * Подмена документа сбрасывает то, что живёт вне разметки: `swapRootAttributes`
 * снимает с `<html>` все атрибуты, а модули не переисполняются. Оба гейта
 * заведены по факту дефектов, найденных на этом переходе.
 */
test.describe('клиентская навигация', () => {
  test('тема переживает подмену документа', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-light', 'достаточно одного проекта')

    await page.goto('/')
    await page.locator('[data-gr-theme-toggle]').click()
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark')

    // Переход именно ссылкой: её обрабатывает роутер, а не браузер.
    await page.locator('nav a', { hasText: 'Settings' }).click()
    await page.waitForURL(url => url.pathname === '/settings/')

    // `data-theme` восстанавливает подписка скрипта на `astro:after-swap`:
    // в полученном документе атрибута нет, скрипт на нём не исполнялся.
    await expect
      .poll(() => page.evaluate(() => document.documentElement.dataset.theme))
      .toBe('dark')
    expect(await page.evaluate(() => document.documentElement.style.colorScheme)).toBe('dark')
  })

  test('строки ядра следуют за языком без перезагрузки', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-light', 'достаточно одного проекта')

    // Метка живёт в документе: полная перезагрузка её сотрёт, клиентский переход — нет.
    await page.addInitScript(() => {
      ;(window as unknown as { __docId: string }).__docId = String(Math.random())
    })
    await page.goto('/')
    const before = await page.evaluate(() => (window as unknown as { __docId: string }).__docId)

    await page.getByTestId('locale-switcher').locator('select').selectOption('ru')
    await page.waitForURL(url => url.pathname === '/ru/')

    expect(
      await page.evaluate(() => (window as unknown as { __docId: string }).__docId),
      'переход оказался жёстким — гейт проверял бы не то',
    ).toBe(before)

    // Панель после гидратации уезжает в портал, и её содержимое рисует **живой**
    // компонент. Подменённая разметка ответить за инстанс не может.
    const panel = page.locator('#gr-portal [data-gr-select-panel], body > [data-gr-select-panel]')
    await expect(panel.locator('[placeholder="Поиск…"]')).toBeAttached()
    await expect(page.locator('[aria-label="Очистить"]')).toBeAttached()
    await expect(page.locator('[aria-label="Clear"]')).toHaveCount(0)
  })
})

/**
 * Страница из Markdown.
 *
 * Контент-коллекции — самая ходовая часть Astro, и на них проверяется то, чего
 * не проверяет ничто другое: работают ли тема, строки и типографика на
 * разметке, которую породил не наш шаблон.
 */
test.describe('контент из Markdown', () => {
  test('отчёт отрисован, оформлен и на языке страницы', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-light', 'достаточно одного проекта')

    await page.goto('/ru/incidents/queue-degradation/')

    // Заголовок и текст пришли из тела `.md`, а не из фронтматтера.
    await expect(page.getByRole('heading', { level: 2, name: 'Что происходит' })).toBeVisible()
    await expect(page.locator('.prose p').first()).toBeVisible()

    // Типографика применилась: без неё абзац унаследовал бы цвет корня.
    const colour = await page.locator('.prose p').first().evaluate(el => getComputedStyle(el).color)
    expect(colour).not.toBe('')
    const heading = await page.getByRole('heading', { level: 2 }).first().evaluate(el => getComputedStyle(el).fontWeight)
    expect(Number(heading)).toBeGreaterThanOrEqual(600)
  })

  test('панель ведёт на отчёт, а диалог не заканчивается датой', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-light', 'достаточно одного проекта')

    await page.goto('/')
    // `Message Queue` — второй сервис в `prod`, у него открытый инцидент.
    await page.getByTestId('service-details').nth(1).click()
    await expect(page.getByRole('dialog')).toBeVisible()

    const link = page.getByTestId('incident-link')
    await expect(link).toBeVisible()
    await link.click()
    await page.waitForURL(url => url.pathname === '/incidents/queue-degradation/')
  })
})

/**
 * Строки пакета-спутника.
 *
 * До этого в сборке был один блок — `gr` ядра, и слияние лоадеров с двумя
 * пакетами не проверялось ничем. `@feugene/granularity-chrono` приводит второй
 * блок `grChrono`, и `deriveI18nBlocks` обязан вывести оба, не перечисляя их.
 */
test.describe('второй пакет строк', () => {
  test.use({ javaScriptEnabled: false })

  test('строки спутника приезжают на языке страницы', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-light', 'достаточно одного проекта')

    await page.goto('/ru/incidents/')

    // `Выбор даты` — `grChrono.datePicker.panelLabel`, строка спутника, не ядра.
    await expect(page.locator('[aria-label="Выбор даты"]').first()).toBeAttached()
    await expect(page.locator('[aria-label="Choose date"]')).toHaveCount(0)
  })

  test('снимок несёт блок спутника, а не блок ядра', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-light', 'достаточно одного проекта')

    await page.goto('/ru/incidents/')

    // Отсечение по страницам: на этой странице строк ядра нет, и тащить блок
    // `gr` сюда незачем. Обратное означало бы, что режим `used` не работает.
    const blocks = await page.evaluate(() => {
      const el = document.querySelector('script[type="application/json"][data-granularity-i18n]')
      const data = JSON.parse(el!.textContent!) as { messages: Record<string, Record<string, unknown>> }
      return Object.fromEntries(Object.entries(data.messages).map(([k, v]) => [k, Object.keys(v)]))
    })
    expect(blocks).toEqual({ ru: ['grChrono'] })
  })
})

/**
 * Форма с валидацией.
 *
 * Тексты ошибок приходят из строк **ядра** (`gr.form.*`), то есть переводятся
 * механикой пакета. Гейт заодно держит доступность: без `aria-invalid` и связи
 * ошибки с полем скринридер о проблеме не узнает.
 */
test.describe('валидация формы', () => {
  test('пустая отправка не проходит и объясняет почему', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-light', 'достаточно одного проекта')

    await page.goto('/ru/settings/')
    await page.getByTestId('sub-submit').click()

    // «Обязательное поле» — строка ядра, а не приложения.
    await expect(page.getByText('Обязательное поле').first()).toBeVisible()
    await expect(page.getByTestId('sub-email')).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByTestId('sub-email')).toHaveAttribute('aria-describedby', /.+/)
    await expect(page.getByTestId('sub-done')).toHaveCount(0)
  })

  test('неверная почта названа отдельно от пустой', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-light', 'достаточно одного проекта')

    await page.goto('/ru/settings/')
    await page.getByTestId('sub-email').fill('не-почта')
    await page.getByTestId('sub-submit').click()

    await expect(page.getByText('Введите корректный e-mail')).toBeVisible()
  })

  test('заполненная форма отправляется и сохраняется', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-light', 'достаточно одного проекта')

    await page.goto('/ru/settings/')
    await page.getByTestId('sub-email').fill('ops@example.com')
    await page.getByTestId('sub-services').click()
    await page.getByRole('listbox').getByText('API Gateway', { exact: true }).click()
    await page.keyboard.press('Escape')
    await page.getByTestId('sub-submit').click()

    await expect(page.getByTestId('sub-done')).toBeVisible()
    expect(await page.evaluate(() => localStorage.getItem('granular-status-subscription')))
      .toContain('ops@example.com')
  })
})

/**
 * Изображения через `astro:assets`.
 *
 * До этого в примере не было ни одной растровой картинки, и сотня в Lighthouse
 * доставалась даром — портить LCP и CLS было нечему.
 */
test.describe('изображения', () => {
  test('оптимизированы, с размерами и локализованным описанием', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-light', 'достаточно одного проекта')

    await page.goto('/ru/incidents/queue-degradation/')
    const img = page.locator('figure img')
    await expect(img).toBeVisible()

    // Размеры на теге — единственное, что резервирует место до загрузки.
    // Без них картинка сдвигает весь текст под собой.
    await expect(img).toHaveAttribute('width', '1200')
    await expect(img).toHaveAttribute('height', '600')

    // Формат и адаптивность — работа `astro:assets`, а не наша.
    await expect(img).toHaveAttribute('src', /\.webp$/)
    const srcset = await img.getAttribute('srcset')
    expect(srcset?.match(/\d+w/g) ?? []).toHaveLength(3)

    // Описание переведено: `alt` берётся из фронтматтера отчёта, а он на языке страницы.
    const alt = await img.getAttribute('alt')
    expect(alt).toContain('Медианное время доставки')
  })

  test('обложка Open Graph абсолютна и с размерами', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-light', 'достаточно одного проекта')

    await page.goto('/')
    const og = page.locator('meta[property="og:image"]')
    // Относительный адрес соцсети не разрешат — картинку просто не покажут.
    await expect(og).toHaveAttribute('content', /^https:\/\/.+\.png$/)
    await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute('content', '1200')
  })
})

test.describe('переключатель языка', () => {
  test('ведёт на ту же страницу в выбранном языке', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-light', 'достаточно одного проекта')

    // Гейт заведён по факту дефекта: `@change` у `GrSelect` в режиме `native`
    // не эмитится вовсе, и переключатель молча ничего не делал. Проверяется
    // именно переход, а не значение селекта — значение менялось и на сломанном.
    await page.goto('/settings/')
    await page.getByTestId('locale-switcher').locator('select').selectOption('ru')

    // Страница сохраняется: выбор языка не должен возвращать на главную.
    await page.waitForURL(url => url.pathname === '/ru/settings/')
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru')
  })

  test('перечисляет все три языка и помечает текущий', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-light', 'достаточно одного проекта')

    await page.goto('/es/')
    const select = page.getByTestId('locale-switcher').locator('select')

    await expect(select).toHaveValue('es')
    expect(await select.locator('option').allTextContents()).toEqual(['English', 'Русский', 'Español'])
  })
})

test.describe('остров', () => {
  test('`GrButton` гидратируется и приезжает в цвете', async ({ page }) => {
    await page.goto('/settings/')
    const button = page.getByTestId('pref-save')
    await expect(button).toBeVisible()

    // Цвет — главное. Бесцветная кнопка означает, что UnoCSS не просканировал
    // `dist` библиотеки, и это самый частый способ собрать портал молча сломанным.
    // Проверяется основная кнопка: у `outline` фона нет по определению.
    const background = await button.evaluate(el => getComputedStyle(el).backgroundColor)
    expect(background).not.toBe('rgba(0, 0, 0, 0)')
    expect(background).not.toBe('transparent')

    // Гидратация: до неё нажатие ничего не меняет.
    await button.click()
    await expect(page.getByRole('status')).toBeVisible()
  })

  test('строки приезжают на языке страницы, а не английским fallback', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-light', 'достаточно одного проекта')

    await page.goto('/ru/')

    // Обе строки — из словаря **ядра**, а не приложения: гейт держит механику
    // пакета, а не переводы примера.
    //
    // Поиск по всей странице, а не внутри фильтра: после гидратации панель
    // уезжает телепортом в `body`, и поле поиска покидает разметку компонента.
    // Кнопка очистки остаётся в триггере — но и её ищем страницей, чтобы тест
    // не зависел от того, что именно телепортировалось.
    await expect(page.locator('[placeholder="Поиск…"]')).toBeAttached()
    await expect(page.locator('[aria-label="Очистить"]')).toBeAttached()
    // Английский на русской странице означает, что блок не доехал и виден fallback.
    await expect(page.locator('[placeholder="Search…"]')).toHaveCount(0)
    await expect(page.locator('[aria-label="Clear"]')).toHaveCount(0)
  })
})

/**
 * Строки в разметке, а не догрузкой.
 *
 * Ассерт выше держит другой факт — что строки на странице русские вообще.
 * Здесь проверяется то, чего он увидеть не может: что они уже лежат в HTML и
 * что первый клиентский рендер строится из снимка, а не из сети.
 */
test.describe('строки в серверной разметке', () => {
  // Единственный способ увидеть именно то, что отдал сервер: с включённым JS
  // гидратация починила бы разметку, и тест прошёл бы мимо предмета.
  test.use({ javaScriptEnabled: false })

  test('`/ru/` приезжает по-русски ещё до гидратации', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-light', 'достаточно одного проекта')

    await page.goto('/ru/')
    const filter = page.getByTestId('env-filter')

    await expect(filter.locator('[placeholder="Поиск…"]')).toBeAttached()
    await expect(filter.locator('[aria-label="Очистить"]')).toBeAttached()
    await expect(filter.locator('[placeholder="Search…"]')).toHaveCount(0)
  })
})

test.describe('снимок строк', () => {
  test('первый клиентский рендер не ждёт сети', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-light', 'достаточно одного проекта')

    // Чанки словарей физически недоступны: остаться русским остров может только
    // из снимка. Гидратации это не мешает — `loadUsedBlocks` на клиенте не ждут,
    // а ошибку загрузки блока fint гасит своим `onError`.
    await page.route('**/_astro/ru-*.js', route => route.abort())
    await page.route('**/_astro/en-*.js', route => route.abort())

    await page.goto('/ru/')
    // Атрибут `ssr` снимает сам `astro-island` после гидратации — иначе тест
    // проверял бы всё ту же серверную разметку.
    await page.locator('astro-island:not([ssr])').first().waitFor()

    const filter = page.getByTestId('env-filter')
    await expect(filter.locator('[aria-label="Очистить"]')).toBeAttached()
    await expect(filter.locator('[aria-label="Clear"]')).toHaveCount(0)
  })

  test('лежит в `<head>` и укладывается в бюджет', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-light', 'достаточно одного проекта')

    await page.goto('/ru/')

    const shape = await page.evaluate(() => {
      const block = document.querySelector('script[type="application/json"][data-granularity-i18n]')
      if (!block?.textContent)
        return null
      return {
        inHead: block.parentElement?.tagName === 'HEAD',
        bytes: block.textContent.length,
        locale: (JSON.parse(block.textContent) as { locale: string }).locale,
      }
    })

    expect(shape, 'блок снимка не найден в разметке').not.toBeNull()
    expect(shape!.inHead).toBe(true)
    expect(shape!.locale).toBe('ru')
    // Бюджет — гейт, как и 512 Б у скрипта темы: снимок лежит на критическом
    // пути документа, и его раздувание обязано ронять прогон, а не проходить
    // незамеченным.
    expect(shape!.bytes).toBeLessThanOrEqual(2048)
  })
})
