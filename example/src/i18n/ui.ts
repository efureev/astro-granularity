/**
 * Строки самого приложения.
 *
 * Обычные объекты, а не блоки `fint-i18n`: они разрешаются во frontmatter на
 * сборке и уезжают в острова пропами. Клиент за них не платит ничего, и в
 * снимок строк они не попадают — тот несёт словарь **ядра**, и это разные вещи.
 */

export const locales = ['en', 'ru', 'es'] as const
export type Locale = (typeof locales)[number]
export const defaultLocale: Locale = 'en'

/** Подпись языка на нём самом — переводить названия языков не принято. */
export const localeNames: Record<Locale, string> = {
  en: 'English',
  ru: 'Русский',
  es: 'Español',
}

export type UiStrings = {
  siteName: string
  tagline: string
  skipToContent: string
  navLabel: string
  navOverview: string
  navSettings: string
  navIncidents: string
  langLabel: string
  themeToLight: string
  themeToDark: string

  overviewTitle: string
  overviewDescription: string
  bannerOperational: string
  bannerDegraded: string
  bannerHint: string

  kpiSectionTitle: string
  kpiUptime: string
  kpiUptimeHint: string
  kpiLatency: string
  kpiLatencyHint: string
  kpiIncidents: string
  kpiIncidentsHint: string

  servicesTitle: string
  envLabel: string
  envAll: string
  statusOperational: string
  statusDegraded: string
  statusOutage: string
  statusHintOperational: string
  statusHintDegraded: string
  statusHintOutage: string
  detailsAction: string
  emptyServices: string

  dialogRegion: string
  dialogUptime: string
  dialogLatency: string
  dialogLastIncident: string
  dialogNoIncidents: string
  dialogClose: string

  lastCheckedLabel: string
  savedLabel: string
  savedEmpty: string

  settingsTitle: string
  settingsDescription: string
  fieldEnv: string
  fieldEnvHint: string
  fieldDensity: string
  fieldDensityHint: string
  fieldNotify: string
  fieldNotifyHint: string
  densityCompact: string
  densityCosy: string
  densityRoomy: string
  notifyAll: string
  notifyIncidents: string
  notifyNone: string
  actionSave: string
  actionReset: string
  saved: string
  resetTitle: string
  resetBody: string
  resetConfirm: string
  resetCancel: string

  footerNote: string
  versionHint: string
  backToTop: string

  notFoundTitle: string
  notFoundBody: string
  notFoundAction: string

  incidentsTitle: string
  incidentsDescription: string
  incidentsEmpty: string
  incidentsSince: string
  incidentsAll: string
  incidentOpen: string
  incidentResolved: string
  incidentService: string
  incidentRead: string
  incidentBack: string
  severityMinor: string
  severityMajor: string
  severityCritical: string

  subscribeTitle: string
  subscribeDescription: string
  fieldEmail: string
  fieldEmailHint: string
  fieldServices: string
  fieldServicesHint: string
  fieldFrequency: string
  freqInstant: string
  freqDaily: string
  freqWeekly: string
  actionSubscribe: string
  subscribing: string
  subscribed: string
  errorPickService: string
}

export const ui: Record<Locale, UiStrings> = {
  en: {
    siteName: 'Granular Status',
    tagline: 'Service health for the Granularity platform.',
    skipToContent: 'Skip to content',
    navLabel: 'Main navigation',
    navOverview: 'Overview',
    navSettings: 'Settings',
    navIncidents: 'Incidents',
    langLabel: 'Language',
    themeToLight: 'Switch to light theme',
    themeToDark: 'Switch to dark theme',

    overviewTitle: 'Service status',
    overviewDescription: 'Live availability, latency and open incidents across every environment.',
    bannerOperational: 'All systems operational',
    bannerDegraded: 'Some systems are degraded',
    bannerHint: 'Updated automatically every minute.',

    kpiSectionTitle: 'Key metrics',
    kpiUptime: 'Uptime',
    kpiUptimeHint: 'Share of successful health checks over the last 30 days.',
    kpiLatency: 'Response time',
    kpiLatencyHint: 'Median across all edge regions.',
    kpiIncidents: 'Open incidents',
    kpiIncidentsHint: 'Incidents not yet resolved.',

    servicesTitle: 'Services',
    envLabel: 'Environment',
    envAll: 'All environments',
    statusOperational: 'Operational',
    statusDegraded: 'Degraded',
    statusOutage: 'Outage',
    statusHintOperational: 'Responding normally, no error budget spent.',
    statusHintDegraded: 'Responding, but slower than the agreed target.',
    statusHintOutage: 'Not responding to health checks.',
    detailsAction: 'Details',
    emptyServices: 'No services in this environment.',

    dialogRegion: 'Region',
    dialogUptime: 'Uptime, 30 days',
    dialogLatency: 'Median latency',
    dialogLastIncident: 'Last incident',
    dialogNoIncidents: 'No incidents on record.',
    dialogClose: 'Close',

    lastCheckedLabel: 'Last checked',
    savedLabel: 'Saved in this browser',
    savedEmpty: 'Nothing saved yet.',

    settingsTitle: 'Settings',
    settingsDescription: 'Preferences are stored in this browser only. Nothing leaves your device.',
    fieldEnv: 'Default environment',
    fieldEnvHint: 'Which environment opens first on the overview page.',
    fieldDensity: 'Density',
    fieldDensityHint: 'How much breathing room the service list gets.',
    fieldNotify: 'Notifications',
    fieldNotifyHint: 'What deserves to interrupt you.',
    densityCompact: 'Compact',
    densityCosy: 'Cosy',
    densityRoomy: 'Roomy',
    notifyAll: 'Every status change',
    notifyIncidents: 'Incidents only',
    notifyNone: 'Nothing',
    actionSave: 'Save preferences',
    actionReset: 'Reset',
    saved: 'Preferences saved.',
    resetTitle: 'Reset preferences?',
    resetBody: 'Saved preferences will be removed from this browser. This cannot be undone.',
    resetConfirm: 'Reset',
    resetCancel: 'Cancel',

    footerNote: 'A demo app for @feugene/astro-granularity.',
    versionHint: 'Version of the design system this demo is built against.',
    backToTop: 'Back to top',

    notFoundTitle: 'Page not found',
    notFoundBody: 'The page you asked for does not exist.',
    notFoundAction: 'Go to overview',

    incidentsTitle: 'Incidents',
    incidentsDescription: 'What broke, what it affected and how it ended.',
    incidentsEmpty: 'No incidents on record.',
    incidentsSince: 'Since',
    incidentsAll: 'All dates',
    incidentOpen: 'Open',
    incidentResolved: 'Resolved',
    incidentService: 'Service',
    incidentRead: 'Read the report',
    incidentBack: 'All incidents',
    severityMinor: 'Minor',
    severityMajor: 'Major',
    severityCritical: 'Critical',
    subscribeTitle: 'Status updates',
    subscribeDescription: 'Get told when something breaks. The address is kept in this browser and sent nowhere.',
    fieldEmail: 'Email',
    fieldEmailHint: 'Where the notice goes.',
    fieldServices: 'Services',
    fieldServicesHint: 'Pick at least one.',
    fieldFrequency: 'How often',
    freqInstant: 'As it happens',
    freqDaily: 'Daily digest',
    freqWeekly: 'Weekly digest',
    actionSubscribe: 'Subscribe',
    subscribing: 'Subscribing',
    subscribed: 'Subscribed. Stored in this browser only.',
    errorPickService: 'Pick at least one service.',
  },

  ru: {
    siteName: 'Granular Status',
    tagline: 'Состояние сервисов платформы Granularity.',
    skipToContent: 'Перейти к содержимому',
    navLabel: 'Основная навигация',
    navOverview: 'Обзор',
    navSettings: 'Настройки',
    navIncidents: 'Инциденты',
    langLabel: 'Язык',
    themeToLight: 'Включить светлую тему',
    themeToDark: 'Включить тёмную тему',

    overviewTitle: 'Состояние сервисов',
    overviewDescription: 'Доступность, время отклика и открытые инциденты по всем средам.',
    bannerOperational: 'Все системы работают',
    bannerDegraded: 'Часть систем деградировала',
    bannerHint: 'Обновляется автоматически раз в минуту.',

    kpiSectionTitle: 'Ключевые показатели',
    kpiUptime: 'Доступность',
    kpiUptimeHint: 'Доля успешных проверок за последние 30 дней.',
    kpiLatency: 'Время отклика',
    kpiLatencyHint: 'Медиана по всем пограничным регионам.',
    kpiIncidents: 'Открытых инцидентов',
    kpiIncidentsHint: 'Инциденты, которые ещё не закрыты.',

    servicesTitle: 'Сервисы',
    envLabel: 'Среда',
    envAll: 'Все среды',
    statusOperational: 'Работает',
    statusDegraded: 'Деградация',
    statusOutage: 'Недоступен',
    statusHintOperational: 'Отвечает штатно, бюджет ошибок не расходуется.',
    statusHintDegraded: 'Отвечает, но медленнее согласованной цели.',
    statusHintOutage: 'Не отвечает на проверки состояния.',
    detailsAction: 'Детали',
    emptyServices: 'В этой среде сервисов нет.',

    dialogRegion: 'Регион',
    dialogUptime: 'Доступность за 30 дней',
    dialogLatency: 'Медианный отклик',
    dialogLastIncident: 'Последний инцидент',
    dialogNoIncidents: 'Инцидентов не было.',
    dialogClose: 'Закрыть',

    lastCheckedLabel: 'Последняя проверка',
    savedLabel: 'Сохранено в этом браузере',
    savedEmpty: 'Пока ничего не сохранено.',

    settingsTitle: 'Настройки',
    settingsDescription: 'Настройки хранятся только в этом браузере и никуда не отправляются.',
    fieldEnv: 'Среда по умолчанию',
    fieldEnvHint: 'Какая среда открывается на странице обзора первой.',
    fieldDensity: 'Плотность',
    fieldDensityHint: 'Сколько воздуха достаётся списку сервисов.',
    fieldNotify: 'Уведомления',
    fieldNotifyHint: 'Что достойно вас отвлечь.',
    densityCompact: 'Плотно',
    densityCosy: 'Обычно',
    densityRoomy: 'Свободно',
    notifyAll: 'Любое изменение статуса',
    notifyIncidents: 'Только инциденты',
    notifyNone: 'Ничего',
    actionSave: 'Сохранить настройки',
    actionReset: 'Сбросить',
    saved: 'Настройки сохранены.',
    resetTitle: 'Сбросить настройки?',
    resetBody: 'Сохранённые настройки будут удалены из этого браузера. Отменить это нельзя.',
    resetConfirm: 'Сбросить',
    resetCancel: 'Отмена',

    footerNote: 'Демонстрационное приложение для @feugene/astro-granularity.',
    versionHint: 'Версия дизайн-системы, под которую собрано это демо.',
    backToTop: 'Наверх',

    notFoundTitle: 'Страница не найдена',
    notFoundBody: 'Страницы, которую вы запросили, не существует.',
    notFoundAction: 'На страницу обзора',

    incidentsTitle: 'Инциденты',
    incidentsDescription: 'Что сломалось, на что повлияло и чем закончилось.',
    incidentsEmpty: 'Инцидентов не было.',
    incidentsSince: 'С даты',
    incidentsAll: 'Все даты',
    incidentOpen: 'Открыт',
    incidentResolved: 'Закрыт',
    incidentService: 'Сервис',
    incidentRead: 'Читать отчёт',
    incidentBack: 'Все инциденты',
    severityMinor: 'Незначительный',
    severityMajor: 'Существенный',
    severityCritical: 'Критический',
    subscribeTitle: 'Оповещения о статусе',
    subscribeDescription: 'Узнавать, когда что-то ломается. Адрес хранится в этом браузере и никуда не отправляется.',
    fieldEmail: 'Почта',
    fieldEmailHint: 'Куда придёт уведомление.',
    fieldServices: 'Сервисы',
    fieldServicesHint: 'Выберите хотя бы один.',
    fieldFrequency: 'Как часто',
    freqInstant: 'Сразу',
    freqDaily: 'Раз в день',
    freqWeekly: 'Раз в неделю',
    actionSubscribe: 'Подписаться',
    subscribing: 'Подписываем',
    subscribed: 'Подписка оформлена. Хранится только в этом браузере.',
    errorPickService: 'Выберите хотя бы один сервис.',
  },

  es: {
    siteName: 'Granular Status',
    tagline: 'Estado de los servicios de la plataforma Granularity.',
    skipToContent: 'Ir al contenido',
    navLabel: 'Navegación principal',
    navOverview: 'Resumen',
    navSettings: 'Ajustes',
    navIncidents: 'Incidencias',
    langLabel: 'Idioma',
    themeToLight: 'Cambiar al tema claro',
    themeToDark: 'Cambiar al tema oscuro',

    overviewTitle: 'Estado de los servicios',
    overviewDescription: 'Disponibilidad, latencia e incidencias abiertas en todos los entornos.',
    bannerOperational: 'Todos los sistemas funcionan',
    bannerDegraded: 'Algunos sistemas están degradados',
    bannerHint: 'Se actualiza automáticamente cada minuto.',

    kpiSectionTitle: 'Métricas clave',
    kpiUptime: 'Disponibilidad',
    kpiUptimeHint: 'Proporción de comprobaciones correctas en los últimos 30 días.',
    kpiLatency: 'Tiempo de respuesta',
    kpiLatencyHint: 'Mediana de todas las regiones perimetrales.',
    kpiIncidents: 'Incidencias abiertas',
    kpiIncidentsHint: 'Incidencias aún sin resolver.',

    servicesTitle: 'Servicios',
    envLabel: 'Entorno',
    envAll: 'Todos los entornos',
    statusOperational: 'Operativo',
    statusDegraded: 'Degradado',
    statusOutage: 'Caído',
    statusHintOperational: 'Responde con normalidad, sin gastar presupuesto de errores.',
    statusHintDegraded: 'Responde, pero más lento que el objetivo acordado.',
    statusHintOutage: 'No responde a las comprobaciones de estado.',
    detailsAction: 'Detalles',
    emptyServices: 'No hay servicios en este entorno.',

    dialogRegion: 'Región',
    dialogUptime: 'Disponibilidad, 30 días',
    dialogLatency: 'Latencia mediana',
    dialogLastIncident: 'Última incidencia',
    dialogNoIncidents: 'Sin incidencias registradas.',
    dialogClose: 'Cerrar',

    lastCheckedLabel: 'Última comprobación',
    savedLabel: 'Guardado en este navegador',
    savedEmpty: 'Todavía no hay nada guardado.',

    settingsTitle: 'Ajustes',
    settingsDescription: 'Los ajustes se guardan solo en este navegador. Nada sale de tu dispositivo.',
    fieldEnv: 'Entorno predeterminado',
    fieldEnvHint: 'Qué entorno se abre primero en la página de resumen.',
    fieldDensity: 'Densidad',
    fieldDensityHint: 'Cuánto aire recibe la lista de servicios.',
    fieldNotify: 'Notificaciones',
    fieldNotifyHint: 'Qué merece interrumpirte.',
    densityCompact: 'Compacta',
    densityCosy: 'Normal',
    densityRoomy: 'Amplia',
    notifyAll: 'Cualquier cambio de estado',
    notifyIncidents: 'Solo incidencias',
    notifyNone: 'Nada',
    actionSave: 'Guardar ajustes',
    actionReset: 'Restablecer',
    saved: 'Ajustes guardados.',
    resetTitle: '¿Restablecer los ajustes?',
    resetBody: 'Los ajustes guardados se borrarán de este navegador. Esto no se puede deshacer.',
    resetConfirm: 'Restablecer',
    resetCancel: 'Cancelar',

    footerNote: 'Aplicación de demostración para @feugene/astro-granularity.',
    versionHint: 'Versión del sistema de diseño con la que está construida esta demo.',
    backToTop: 'Volver arriba',

    notFoundTitle: 'Página no encontrada',
    notFoundBody: 'La página que has pedido no existe.',
    notFoundAction: 'Ir al resumen',

    incidentsTitle: 'Incidencias',
    incidentsDescription: 'Qué se rompió, a qué afectó y cómo terminó.',
    incidentsEmpty: 'Sin incidencias registradas.',
    incidentsSince: 'Desde',
    incidentsAll: 'Todas las fechas',
    incidentOpen: 'Abierta',
    incidentResolved: 'Resuelta',
    incidentService: 'Servicio',
    incidentRead: 'Leer el informe',
    incidentBack: 'Todas las incidencias',
    severityMinor: 'Leve',
    severityMajor: 'Importante',
    severityCritical: 'Crítica',
    subscribeTitle: 'Avisos de estado',
    subscribeDescription: 'Enterarse cuando algo se rompe. La dirección se guarda en este navegador y no se envía a ninguna parte.',
    fieldEmail: 'Correo',
    fieldEmailHint: 'Adónde llega el aviso.',
    fieldServices: 'Servicios',
    fieldServicesHint: 'Elige al menos uno.',
    fieldFrequency: 'Con qué frecuencia',
    freqInstant: 'Al momento',
    freqDaily: 'Resumen diario',
    freqWeekly: 'Resumen semanal',
    actionSubscribe: 'Suscribirse',
    subscribing: 'Suscribiendo',
    subscribed: 'Suscripción hecha. Se guarda solo en este navegador.',
    errorPickService: 'Elige al menos un servicio.'
  },
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (locales as readonly string[]).includes(value)
}

/** Строки локали. Незнакомое значение — язык по умолчанию, а не падение. */
export function strings(locale: string | undefined): UiStrings {
  return ui[isLocale(locale) ? locale : defaultLocale]
}
