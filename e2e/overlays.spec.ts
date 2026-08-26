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
 * Фикстура — панель состояния на `/` (`client:load`), и три пути к порталу в ней
 * **разные по устройству**, в чём и смысл: `GrTooltip` работает с `@floating-ui`
 * напрямую, `GrSelect` в `optionsView="panel"` телепортирует сам (нативный
 * `<select>` портала не имеет вовсе), а `GrDialog` портал не упоминает — он
 * рендерит `GrModal`, тот самый composed-случай, который не выводится
 * сканированием исходников. Меньше трёх — гейт перестаёт покрывать все пути.
 */

/** Подсказка статуса «работает» на английской странице — текст из `ui.ts`. */
const OPERATIONAL_HINT = 'Responding normally, no error budget spent.'

test.describe('серверная разметка', () => {
  // Без JS остаётся ровно то, что отдал сервер. `client:only` здесь дал бы
  // пустой контейнер — на этом и держится обратный прогон гейта.
  test.use({ javaScriptEnabled: false })

  test('оверлеи приезжают с сервера, а не пустым контейнером', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByTestId('service-board')).toBeAttached()
    await expect(page.getByTestId('status-hint').first()).toBeVisible()
    await expect(page.getByTestId('env-filter')).toBeVisible()
    await expect(page.getByTestId('service-details').first()).toBeVisible()
  })

  test('панель `GrSelect` рендерится на месте, а не переезжает в `body`', async ({ page }) => {
    await page.goto('/')

    // Панель приходит скрытой, внутри разметки своего компонента: телепорт
    // включится только в `onMounted`. Поэтому проверяется наличие в DOM,
    // а не видимость.
    // Именно внутри списка, а не где угодно в компоненте: выбранное значение
    // дублируется подписью триггера, и поиск по тексту нашёл бы его тоже.
    const panel = page.getByTestId('env-filter').locator('[role="listbox"]')
    for (const label of ['prod', 'staging', 'dev'])
      await expect(panel.getByText(label, { exact: true })).toBeAttached()
  })

  test('содержимое модалки на сервер не уезжает — и это норма', async ({ page }) => {
    await page.goto('/')

    // Единственное задокументированное исключение: `GrModal` не отдаёт слот на
    // сервер даже открытым. Ассерт держит это как знание, а не как случайность —
    // иначе появление содержимого в SSR прошло бы незамеченным.
    await expect(page.getByTestId('dialog-body')).toHaveCount(0)
    await expect(page.getByTestId('service-details').first()).toBeVisible()
  })
})

/*
 * Чего этот файл НЕ проверяет: совпадение первого клиентского рендера с
 * серверным. Vue сообщает о расхождении гидратации только в production-сборке
 * молчанием, а `astro dev` в этом проекте не стартует (Astro 7.2.7 / Node 26).
 * Проверка, которая не может упасть, хуже отсутствующей, поэтому её здесь нет.
 */

test.describe('интерактив после гидратации', () => {
  test('панель `GrSelect` раскрывается и фильтрует список', async ({ page }) => {
    await page.goto('/')

    const board = page.getByTestId('service-board')
    // На `prod` три сервиса; на `staging` — два. Ассерт на число строк ловит и
    // раскрытие панели, и то, что выбор действительно применился.
    await expect(board.getByTestId('service-details')).toHaveCount(3)

    await page.getByTestId('env-filter').click()
    const listbox = page.getByRole('listbox')
    await expect(listbox).toBeVisible()

    await listbox.getByText('staging', { exact: true }).click()
    await expect(page.getByTestId('env-filter')).toContainText('staging')
    await expect(board.getByTestId('service-details')).toHaveCount(2)
  })

  test('тултип показывается по наведению', async ({ page }) => {
    await page.goto('/')

    await page.getByTestId('status-hint').first().hover()
    await expect(page.getByText(OPERATIONAL_HINT).first()).toBeVisible()
  })

  test('диалог открывается и закрывается по `Escape`', async ({ page }) => {
    await page.goto('/')

    await page.getByTestId('service-details').first().click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByTestId('dialog-body')).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toBeHidden()
  })
})
