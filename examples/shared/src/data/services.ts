/**
 * Данные панели.
 *
 * Заданы литералами и без единого обращения к часам или случайности: сборка
 * обязана быть воспроизводимой, а гейты — цепляться за стабильные числа.
 */

export type ServiceStatus = 'operational' | 'degraded' | 'outage'
export type Environment = 'prod' | 'staging' | 'dev'

export type Service = {
  id: string
  /** Имена сервисов — собственные, поэтому не переводятся. */
  name: string
  env: Environment
  status: ServiceStatus
  /** Доступность за 30 дней, проценты. */
  uptime: number
  /** Медианный отклик, мс. */
  latency: number
  region: string
  /** ISO-дата последнего инцидента либо `null`. */
  lastIncident: string | null
}

export const environments: readonly Environment[] = ['prod', 'staging', 'dev']

export const services: readonly Service[] = [
  { id: 'gateway', name: 'API Gateway', env: 'prod', status: 'operational', uptime: 99.98, latency: 142, region: 'eu-central', lastIncident: '2026-06-14' },
  { id: 'queue', name: 'Message Queue', env: 'prod', status: 'degraded', uptime: 99.41, latency: 604, region: 'eu-central', lastIncident: '2026-08-24' },
  { id: 'storage', name: 'Object Storage', env: 'prod', status: 'operational', uptime: 99.99, latency: 88, region: 'eu-west', lastIncident: null },
  { id: 'identity', name: 'Identity', env: 'staging', status: 'operational', uptime: 99.87, latency: 121, region: 'eu-central', lastIncident: '2026-07-02' },
  { id: 'cdn', name: 'Edge CDN', env: 'staging', status: 'degraded', uptime: 99.12, latency: 310, region: 'global', lastIncident: '2026-08-19' },
  { id: 'sandbox', name: 'Sandbox Runner', env: 'dev', status: 'outage', uptime: 96.30, latency: 0, region: 'eu-west', lastIncident: '2026-08-26' },
]

/** Сводка по срезу: то, что показывают три карточки и баннер. */
export function summarize(list: readonly Service[]) {
  if (list.length === 0)
    return { uptime: 0, latency: 0, incidents: 0, healthy: true }

  const responding = list.filter(s => s.latency > 0)
  return {
    uptime: list.reduce((sum, s) => sum + s.uptime, 0) / list.length,
    latency: responding.length === 0
      ? 0
      : Math.round(responding.reduce((sum, s) => sum + s.latency, 0) / responding.length),
    incidents: list.filter(s => s.status !== 'operational').length,
    healthy: list.every(s => s.status === 'operational'),
  }
}
