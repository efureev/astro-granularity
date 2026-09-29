import { spawn, spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

/**
 * Держатель `astro dev` для Playwright.
 *
 * `astro dev` в Astro 7 умеет уходить в фон сам: он распознаёт окружение
 * CI-агента (`isRunByAgent`) и печатает «Dev server running (pid …)», возвращая
 * управление. Playwright считает такой процесс упавшим («Process from
 * config.webServer exited early»), а демон продолжает жить и занимать порт до
 * следующего прогона — тот же капкан, что с `astro preview` (см. `serve.mjs`).
 * Останавливать демона по сигналу ненадёжно: Playwright вправе убить держатель
 * жёстко, и тогда убирать будет некому. Проверено — порт оставался занят.
 *
 * Поэтому автодетект отключается переменной `ASTRO_DEV_BACKGROUND`, и сервер
 * работает на переднем плане: он умирает вместе с этим процессом, а порт
 * освобождается сам. Держатель нужен только чтобы дождаться готовности и
 * не дать Playwright решить, что команда завершилась.
 */
const port = Number(process.argv[2] ?? 4334)
const cwd = resolve(process.argv[3] ?? '.')
const bin = resolve(import.meta.dirname, '../node_modules/.bin/astro')

/** Управление возвращается, как только демон ответил или вышло время. */
async function waitForPort(deadlineMs = 60_000) {
  const until = Date.now() + deadlineMs
  while (Date.now() < until) {
    try {
      const response = await fetch(`http://localhost:${port}/`)
      if (response.status > 0)
        return
    }
    catch {
      // Сервер ещё не слушает — это нормальный путь, а не ошибка.
    }
    await new Promise(done => setTimeout(done, 250))
  }
  throw new Error(`[dev-server] порт ${port} не ответил за ${deadlineMs} мс`)
}

/*
 * Прогрев: первая же загрузка страницы заставляет Vite досканировать и
 * пересобрать зависимости, и запросы, попавшие в этот момент, получают `504
 * Outdated Optimize Dep`. Порт при этом отвечает давно, поэтому без прогрева
 * гейт падал бы на холодном старте — на гонке, а не на дефекте.
 */
async function warmUp() {
  for (const path of ['/', '/settings/']) {
    try {
      await fetch(`http://localhost:${port}${path}`)
    }
    catch {
      // Прогрев — не проверка: его неудача ничего не доказывает.
    }
  }
  await new Promise(done => setTimeout(done, 1500))
}

const start = spawn(bin, ['dev', '--port', String(port)], {
  cwd,
  stdio: 'inherit',
  // Любое непустое значение выключает автодетект агента: `agentDetected`
  // считается как `!process.env.ASTRO_DEV_BACKGROUND && isRunByAgent()`.
  env: { ...process.env, ASTRO_DEV_BACKGROUND: '0' },
})

function cleanUp() {
  if (start.exitCode === null)
    start.kill('SIGTERM')
  // На случай, если автодетект всё же сработал и демон остался: синхронно,
  // иначе `process.exit()` обгонит асинхронный `spawn`.
  spawnSync(bin, ['dev', 'stop'], { cwd, stdio: 'ignore' })
}

// Сервер умер сам — держаться не за что, и Playwright обязан узнать об этом.
start.on('exit', code => process.exit(code ?? 1))
start.on('error', (error) => {
  console.error('[dev-server] не удалось запустить astro dev:', error)
  process.exit(1)
})

await waitForPort()
await warmUp()
console.log(`[dev-server] astro dev слушает http://localhost:${port}/ (каталог ${cwd})`)

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    cleanUp()
    process.exit(0)
  })
}

/*
 * Держимся на переднем плане: Playwright остановит нас сигналом.
 *
 * Таймер здесь несущий, а не для красоты: когда `astro dev` ушёл в фон, своих
 * активных хендлов у процесса не остаётся, и Node выходит из пустого цикла
 * событий сразу — вместе с обработчиками сигналов. Демон при этом переживает
 * прогон и занимает порт следующему.
 */
const keepAlive = setInterval(() => {}, 1 << 30)
process.on('exit', () => clearInterval(keepAlive))
