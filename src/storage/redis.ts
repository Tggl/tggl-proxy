import { Storage } from '../types'
import { createClient, RedisClientType } from 'redis'

export type RedisErrorCode =
  | 'FAILED_TO_CONNECT'
  | 'FAILED_TO_FETCH_CONFIG'
  | 'FAILED_TO_WRITE_CONFIG'

export class RedisError extends Error {
  private code: RedisErrorCode
  private error: Error

  constructor(code: RedisErrorCode, message: string, error: Error) {
    super(`${message}: ${error.message}`)
    this.name = 'RedisError'
    this.code = code
    this.error = error
  }
}

export class RedisStorage implements Storage {
  // @ts-ignore
  private client: RedisClientType
  private ready: Promise<void>
  public name = 'Redis'

  constructor(private connectionString: string) {
    this.ready = this.init()
    this.ready.catch(() => null)
  }

  private async init() {
    try {
      this.client = createClient({
        url: this.connectionString,
      })
      await this.client.connect()
    } catch (error) {
      throw new RedisError(
        'FAILED_TO_CONNECT',
        'Failed to connect to Redis',
        error as Error
      )
    }
  }

  async getConfig() {
    try {
      await this.ready

      const data = await this.client.hGetAll('tggl_config')

      if (!data.config || !data.syncDate) {
        throw new Error('Successfully connected, but no config found')
      }

      return {
        config: data.config,
        syncDate: new Date(Number(data.syncDate)),
      }
    } catch (error) {
      throw new RedisError(
        'FAILED_TO_FETCH_CONFIG',
        'Failed to fetch config from Redis',
        error as Error
      )
    }
  }

  async setConfig(config: string, syncDate: Date) {
    try {
      await this.ready

      const lastSyncDate = await this.client.hGet('tggl_config', 'syncDate')

      if (!lastSyncDate || new Date(lastSyncDate) < syncDate) {
        await this.client.hSet('tggl_config', {
          config,
          syncDate: syncDate.getTime(),
        })
      }
    } catch (error) {
      throw new RedisError(
        'FAILED_TO_WRITE_CONFIG',
        'Failed to write config to Redis',
        error as Error
      )
    }
  }
}