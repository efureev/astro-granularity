import { createReadStream, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize, resolve } from 'node:path'

/**
 * Форграунд-сервер статики примера для Playwright.
 *
 * `astro preview` здесь не годится: в Astro 7.2.7 он демонизируется — печатает
 * «Preview server running (pid …)» и возвращает управление через секунду.
 * Playwright считает такой процесс упавшим («Process from config.webServer
 * exited early»), а демон продолжает жить и отдавать **ту сборку, с которой был
 * запущен**. Пока демон висел, гейт зеленел на произвольно старом коде и не мог
 * упасть — ровно то, ради чего e2e и заводится.
 *
 * Здесь нужен процесс, который держится на переднем плане и умирает вместе с
 * прогоном. Своих зависимостей не тянем: задача — отдать `dist/` как есть.
 */
const port = Number(process.argv[2] ?? 4331)
const root = resolve(process.argv[3] ?? 'dist')

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
}

/**
 * `normalize` до склейки, а не после: без него `GET /../../etc/passwd`
 * вышел бы за корень. Сервер локальный, но тест на нём — не повод.
 */
function resolveFile(urlPath) {
  const clean = normalize(decodeURIComponent(urlPath.split('?')[0])).replace(/^(\.\.[/\\])+/, '')
  const target = join(root, clean)
  if (!target.startsWith(root))
    return null

  try {
    return statSync(target).isDirectory() ? join(target, 'index.html') : target
  }
  catch {
    // Astro пишет маршруты и как `/ru/index.html`, и как `/ru.html`.
    const asHtml = `${target}.html`
    try {
      statSync(asHtml)
      return asHtml
    }
    catch {
      return null
    }
  }
}

createServer((request, response) => {
  const file = resolveFile(request.url ?? '/')
  if (!file) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
    response.end('not found')
    return
  }

  response.writeHead(200, {
    'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
    // Иначе браузер отдаст из кэша разметку прошлой сборки, и гейт снова
    // окажется проверяющим не то, что собрано.
    'cache-control': 'no-store',
  })
  createReadStream(file).pipe(response)
}).listen(port, '127.0.0.1', () => {
  console.log(`serving ${root} at http://127.0.0.1:${port}/`)
})
