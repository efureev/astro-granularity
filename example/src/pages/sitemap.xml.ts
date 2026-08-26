import type { APIRoute } from 'astro'
import { alternates, localePath, pageKeys } from '../i18n/routing'
import { defaultLocale, locales } from '../i18n/ui'

/**
 * Карта сайта эндпоинтом, а не интеграцией.
 *
 * `@astrojs/sitemap` умеет больше, но здесь шесть адресов и все они выводятся
 * из тех же `pageKeys`/`locales`, что и меню с `hreflang`. Общий источник
 * важнее: разъехавшаяся карта сайта — дефект, который никто не замечает.
 */
export const GET: APIRoute = ({ site }) => {
  if (!site)
    throw new Error('[example] карта сайта требует `site` в `astro.config.mjs`.')

  const urls = locales.flatMap(locale =>
    pageKeys.map((page) => {
      const links = alternates(page)
        .map(alt => `      <xhtml:link rel="alternate" hreflang="${alt.locale}" href="${new URL(alt.path, site).href}"/>`)
        .concat(`      <xhtml:link rel="alternate" hreflang="x-default" href="${new URL(localePath(defaultLocale, page), site).href}"/>`)
        .join('\n')

      return `    <url>\n      <loc>${new URL(localePath(locale, page), site).href}</loc>\n${links}\n    </url>`
    }),
  )

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join('\n')}
</urlset>
`

  return new Response(body, { headers: { 'content-type': 'application/xml; charset=utf-8' } })
}
