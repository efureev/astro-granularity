import { expect, test } from '@playwright/test'

/**
 * Доказательство того, что оверлеи ядра — обычные острова.
 *
 * `client:only="vue"` компонентам ядра не нужен: `useTeleportEnabled()` выключает
 * телепорт на сервере и на первом клиентском рендере, поэтому серверная разметка и
 * первый клиентский рендер совпадают. Правило «компонент работает с порталом, значит
 * не переживёт SSR» выводится из устройства компонента, а не из наблюдения, и здесь
 * оно неверно — поэтому факт держится гейтом, а не списком имён.
 *
 * Здесь это проверяется тремя независимыми способами. Фикстура — остров
 * `OverlayDemo` на `client:load` в `example/`: `GrTooltip` (работает с
 * `@floating-ui` напрямую), `GrSelect` в `optionsView="panel"` (свой телепорт;
 * нативный `<select>` портала не имеет вовсе) и `GrDialog` (портал не упоминает —
 * рендерит `GrModal`, тот самый composed-случай, который не выводится
 * сканированием исходников).
 */

test.describe('серверная разметка', () => {
  // Без JS остаётся ровно то, что отдал сервер. `client:only` здесь дал бы
  // пустой контейнер — на этом и держится обратный прогон гейта.
  test.use({ javaScriptEnabled: false })

  test('оверлеи приезжают с сервера, а не пустым контейнером', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByTestId('overlays')).toBeAttached()
    await expect(page.getByTestId('tooltip-trigger')).toBeVisible()
    await expect(page.getByTestId('select-trigger')).toBeVisible()
    await expect(page.getByTestId('dialog-trigger')).toBeVisible()
  })

  test('панель `GrSelect` рендерится на месте, а не переезжает в `body`', async ({ page }) => {
    await page.goto('/')

    // Панель приходит скрытой, внутри разметки своего компонента: телепорт
    // включится только в `onMounted`. Поэтому проверяется наличие в DOM,
    // а не видимость.
    const panel = page.getByTestId('select-trigger')
    for (const label of ['Apple', 'Pear', 'Plum'])
      await expect(panel.getByText(label, { exact: true })).toBeAttached()
  })

  test('содержимое модалки на сервер не уезжает — и это норма', async ({ page }) => {
    await page.goto('/')

    // Единственное задокументированное исключение: `GrModal` не отдаёт слот на
    // сервер даже открытым. Ассерт держит это как знание, а не как случайность —
    // иначе появление содержимого в SSR прошло бы незамеченным.
    await expect(page.getByTestId('dialog-body')).toHaveCount(0)
    await expect(page.getByTestId('dialog-trigger')).toBeVisible()
  })
})

/*
 * Чего этот файл НЕ проверяет: совпадение первого клиентского рендера с
 * серверным. Vue сообщает о расхождении гидратации только в dev-сборке, а
 * гейт работает на `astro preview`. Отдельный dev-сервер завести не вышло —
 * `astro dev` в этом проекте не стартует (Astro 7.2.7 / Node 26). Проверка,
 * которая не может упасть, хуже отсутствующей, поэтому её здесь нет.
 */

test.describe('интерактив после гидратации', () => {
  test('панель `GrSelect` раскрывается и выбирает значение', async ({ page }) => {
    await page.goto('/')

    await page.getByTestId('select-trigger').click()
    const listbox = page.getByRole('listbox')
    await expect(listbox).toBeVisible()

    await listbox.getByText('Pear', { exact: true }).click()
    await expect(page.getByTestId('select-trigger')).toContainText('Pear')
  })

  test('тултип показывается по наведению', async ({ page }) => {
    await page.goto('/')

    await page.getByTestId('tooltip-trigger').hover()
    await expect(page.getByText('Tooltip payload')).toBeVisible()
  })

  test('диалог открывается и закрывается по `Escape`', async ({ page }) => {
    await page.goto('/')

    await page.getByTestId('dialog-trigger').click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByTestId('dialog-body')).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toBeHidden()
  })
})
