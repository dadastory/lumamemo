import type { StorageConfig } from '../../server/services/storage'

export interface LumaMemoConfig {
  storage: StorageConfig
}

export interface MatomoConfig {
  enabled: boolean
  url: string
  siteId: string
}

export interface AnalyticsConfig {
  matomo: MatomoConfig
}
