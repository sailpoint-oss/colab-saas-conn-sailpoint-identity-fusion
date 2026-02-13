// Raise EventEmitter listener limit before any FormData usage. The sailpoint-api-client uses
// form-data for OAuth and multipart requests; with axios-retry, retries add error listeners
// to the same FormData instance, exceeding the default limit of 10 (e.g. 1 + 10 retries = 11).
import { EventEmitter } from 'events'
EventEmitter.defaultMaxListeners = Math.max(EventEmitter.defaultMaxListeners || 0, 20)

import {
    ConnectorError,
    ConnectorErrorType,
    StdAccountCreateHandler,
    StdAccountDisableHandler,
    StdAccountDiscoverSchemaHandler,
    StdAccountEnableHandler,
    StdAccountListHandler,
    StdAccountReadHandler,
    StdAccountUpdateHandler,
    StdEntitlementListHandler,
    StdTestConnectionHandler,
    createConnector,
    logger,
} from '@sailpoint/connector-sdk'
import { safeReadConfig } from './data/config'

import { FusionConfig } from './model/config'
import { ServiceRegistry } from './services/serviceRegistry'
import { testConnection } from './operations/testConnection'
import { accountList } from './operations/accountList'
import { accountRead } from './operations/accountRead'
import { accountCreate } from './operations/accountCreate'
import { accountUpdate } from './operations/accountUpdate'
import { accountEnable } from './operations/accountEnable'
import { accountDisable } from './operations/accountDisable'
import { entitlementList } from './operations/entitlementList'
import { accountDiscoverSchema } from './operations/accountDiscoverSchema'
import { isProxyMode, isProxyService, proxy } from './utils/proxy'

/**
 * Identity Fusion NG connector factory. Loads configuration and returns a configured
 * connector instance with all standard operations (test connection, account list/read/create/update,
 * entitlement list, schema discovery). Supports custom, proxy, and default run modes.
 *
 * @returns A promise that resolves to the configured connector
 */
export const connector = async () => {
    const config: FusionConfig = await safeReadConfig()
    //==============================================================================================================

    const stdTest: StdTestConnectionHandler = async (context, input, res) => {
        let serviceRegistry: ServiceRegistry | undefined
        try {
            serviceRegistry = new ServiceRegistry(config, context, 'testConnection')
            const isCustom = context.testConnection !== undefined
            const isProxy = isProxyMode(config)
            const runMode = isCustom ? 'custom' : isProxy ? 'proxy' : 'default'

            logger.info(`Running in ${runMode} mode`)

            switch (runMode) {
                case 'custom':
                    await context.testConnection(serviceRegistry, input, res)
                    break
                case 'proxy':
                    await proxy(context, input, res)
                    break
                default:
                    await testConnection(serviceRegistry, input, res)
            }
        } catch (error) {
            if (error instanceof ConnectorError) throw error
            logger.error(error)
            const detail = error instanceof Error ? error.message : String(error)
            throw new ConnectorError(`Failed to test connection: ${detail}`, ConnectorErrorType.Generic)
        } finally {
            void serviceRegistry?.log.flush()
            ServiceRegistry.clear()
        }
    }

    const stdAccountList: StdAccountListHandler = async (context, input, res): Promise<void> => {
        const isCustom = context.accountList !== undefined
        const isProxy = isProxyMode(config)
        const isProxyServer = isProxyService(config)
        const runMode = isCustom ? 'custom' : isProxy ? 'proxy' : 'default'

        const interval = isProxyServer ? undefined : setInterval(() => {
            res.keepAlive()
        }, config.processingWait)

        let serviceRegistry: ServiceRegistry | undefined
        try {
            serviceRegistry = new ServiceRegistry(config, context, 'accountList')
            logger.info(`Running accountList in ${runMode} mode`)

            switch (runMode) {
                case 'custom':
                    await context.accountList(serviceRegistry, input, res)
                    break
                case 'proxy':
                    await proxy(context, input, res)
                    break
                default:
                    await accountList(serviceRegistry, input, res)
            }
        } catch (error) {
            if (error instanceof ConnectorError) throw error
            logger.error(error)
            const detail = error instanceof Error ? error.message : String(error)
            throw new ConnectorError(`Failed to aggregate accounts: ${detail}`, ConnectorErrorType.Generic)
        } finally {
            // Fire-and-forget: do not block the response on external log delivery.
            // Awaiting flush can block the handler from returning, keeping the client waiting.
            void serviceRegistry?.log.flush()
            ServiceRegistry.clear()
            if (interval) {
                clearInterval(interval)
            }
        }
    }

    const stdAccountRead: StdAccountReadHandler = async (context, input, res): Promise<void> => {
        const isCustom = context.accountRead !== undefined
        const isProxy = isProxyMode(config)
        const runMode = isCustom ? 'custom' : isProxy ? 'proxy' : 'default'

        let serviceRegistry: ServiceRegistry | undefined
        try {
            serviceRegistry = new ServiceRegistry(config, context, 'accountRead')
            logger.info(`Running accountRead in ${runMode} mode`)
            switch (runMode) {
                case 'custom':
                    await context.accountRead(serviceRegistry, input, res)
                    break
                case 'proxy':
                    await proxy(context, input, res)
                    break
                default:
                    await accountRead(serviceRegistry, input, res)
            }
        } catch (error) {
            if (error instanceof ConnectorError) throw error
            logger.error(error)
            const detail = error instanceof Error ? error.message : String(error)
            throw new ConnectorError(`Failed to read account ${input.identity}: ${detail}`, ConnectorErrorType.Generic)
        } finally {
            void serviceRegistry?.log.flush()
            ServiceRegistry.clear()
        }
    }

    const stdAccountCreate: StdAccountCreateHandler = async (context, input, res) => {
        const isCustom = context.accountCreate !== undefined
        const isProxy = isProxyMode(config)
        const runMode = isCustom ? 'custom' : isProxy ? 'proxy' : 'default'

        let serviceRegistry: ServiceRegistry | undefined
        try {
            serviceRegistry = new ServiceRegistry(config, context, 'accountCreate')
            logger.info(`Running accountCreate in ${runMode} mode`)

            switch (runMode) {
                case 'custom':
                    await context.accountCreate(serviceRegistry, input, res)
                    break
                case 'proxy':
                    await proxy(context, input, res)
                    break
                default:
                    await accountCreate(serviceRegistry, input, res)
            }
        } catch (error) {
            if (error instanceof ConnectorError) throw error
            logger.error(error)
            const detail = error instanceof Error ? error.message : String(error)
            throw new ConnectorError(
                `Failed to create account ${input.attributes.name ?? input.identity}: ${detail}`,
                ConnectorErrorType.Generic
            )
        } finally {
            void serviceRegistry?.log.flush()
            ServiceRegistry.clear()
        }
    }

    const stdAccountUpdate: StdAccountUpdateHandler = async (context, input, res) => {
        const isCustom = context.accountUpdate !== undefined
        const isProxy = isProxyMode(config)
        const runMode = isCustom ? 'custom' : isProxy ? 'proxy' : 'default'

        const interval =
            runMode === 'proxy'
                ? undefined
                : setInterval(() => {
                    res.keepAlive()
                }, config.processingWait)

        let serviceRegistry: ServiceRegistry | undefined
        try {
            serviceRegistry = new ServiceRegistry(config, context, 'accountUpdate')
            logger.info(`Running accountUpdate in ${runMode} mode`)

            switch (runMode) {
                case 'custom':
                    await context.accountUpdate(serviceRegistry, input, res)
                    break
                case 'proxy':
                    await proxy(context, input, res)
                    break
                default:
                    await accountUpdate(serviceRegistry, input, res)
            }
        } catch (error) {
            if (error instanceof ConnectorError) throw error
            logger.error(error)
            const detail = error instanceof Error ? error.message : String(error)
            throw new ConnectorError(`Failed to update account ${input.identity}: ${detail}`, ConnectorErrorType.Generic)
        } finally {
            void serviceRegistry?.log.flush()
            ServiceRegistry.clear()
            if (interval) {
                clearInterval(interval)
            }
        }
    }

    const stdAccountEnable: StdAccountEnableHandler = async (context, input, res) => {
        const isCustom = context.accountEnable !== undefined
        const isProxy = isProxyMode(config)
        const runMode = isCustom ? 'custom' : isProxy ? 'proxy' : 'default'

        let serviceRegistry: ServiceRegistry | undefined
        try {
            serviceRegistry = new ServiceRegistry(config, context, 'accountEnable')
            logger.info(`Running accountEnable in ${runMode} mode`)

            switch (runMode) {
                case 'custom':
                    await context.accountEnable(serviceRegistry, input, res)
                    break
                case 'proxy':
                    await proxy(context, input, res)
                    break
                default:
                    await accountEnable(serviceRegistry, input, res)
            }
        } catch (error) {
            if (error instanceof ConnectorError) throw error
            logger.error(error)
            const detail = error instanceof Error ? error.message : String(error)
            throw new ConnectorError(`Failed to enable account ${input.identity}: ${detail}`, ConnectorErrorType.Generic)
        } finally {
            void serviceRegistry?.log.flush()
            ServiceRegistry.clear()
        }
    }

    const stdAccountDisable: StdAccountDisableHandler = async (context, input, res) => {
        const isCustom = context.accountDisable !== undefined
        const isProxy = isProxyMode(config)
        const runMode = isCustom ? 'custom' : isProxy ? 'proxy' : 'default'

        let serviceRegistry: ServiceRegistry | undefined
        try {
            serviceRegistry = new ServiceRegistry(config, context, 'accountDisable')
            logger.info(`Running accountDisable in ${runMode} mode`)

            switch (runMode) {
                case 'custom':
                    await context.accountDisable(serviceRegistry, input, res)
                    break
                case 'proxy':
                    await proxy(context, input, res)
                    break
                default:
                    await accountDisable(serviceRegistry, input, res)
            }
        } catch (error) {
            if (error instanceof ConnectorError) throw error
            logger.error(error)
            const detail = error instanceof Error ? error.message : String(error)
            throw new ConnectorError(`Failed to disable account ${input.identity}: ${detail}`, ConnectorErrorType.Generic)
        } finally {
            void serviceRegistry?.log.flush()
            ServiceRegistry.clear()
        }
    }

    const stdEntitlementList: StdEntitlementListHandler = async (context, input, res) => {
        const isCustom = context.entitlementList !== undefined
        const isProxy = isProxyMode(config)
        const runMode = isCustom ? 'custom' : isProxy ? 'proxy' : 'default'

        let serviceRegistry: ServiceRegistry | undefined
        try {
            serviceRegistry = new ServiceRegistry(config, context, 'entitlementList')
            logger.info(`Running entitlementList in ${runMode} mode`)

            switch (runMode) {
                case 'custom':
                    await context.entitlementList(serviceRegistry, input, res)
                    break
                case 'proxy':
                    await proxy(context, input, res)
                    break
                default:
                    await entitlementList(serviceRegistry, input, res)
            }
        } catch (error) {
            if (error instanceof ConnectorError) throw error
            logger.error(error)
            const detail = error instanceof Error ? error.message : String(error)
            throw new ConnectorError(`Failed to list entitlements for type ${input.type}: ${detail}`, ConnectorErrorType.Generic)
        } finally {
            void serviceRegistry?.log.flush()
            ServiceRegistry.clear()
        }
    }

    const stdAccountDiscoverSchema: StdAccountDiscoverSchemaHandler = async (context, input, res) => {
        const isCustom = context.accountDiscoverSchema !== undefined
        const isProxy = isProxyMode(config)
        const runMode = isCustom ? 'custom' : isProxy ? 'proxy' : 'default'

        let serviceRegistry: ServiceRegistry | undefined
        try {
            serviceRegistry = new ServiceRegistry(config, context, 'accountDiscoverSchema')
            logger.info(`Running accountDiscoverSchema in ${runMode} mode`)

            switch (runMode) {
                case 'custom':
                    await context.accountDiscoverSchema(serviceRegistry, res)
                    break
                case 'proxy':
                    await proxy(context, input, res)
                    break
                default:
                    await accountDiscoverSchema(serviceRegistry, res)
            }
        } catch (error) {
            if (error instanceof ConnectorError) throw error
            logger.error(error)
            const detail = error instanceof Error ? error.message : String(error)
            throw new ConnectorError(`Failed to discover schema: ${detail}`, ConnectorErrorType.Generic)
        } finally {
            void serviceRegistry?.log.flush()
            ServiceRegistry.clear()
        }
    }

    return createConnector()
        .stdTestConnection(stdTest)
        .stdAccountList(stdAccountList)
        .stdAccountRead(stdAccountRead)
        .stdAccountCreate(stdAccountCreate)
        .stdAccountUpdate(stdAccountUpdate)
        .stdAccountEnable(stdAccountEnable)
        .stdAccountDisable(stdAccountDisable)
        .stdEntitlementList(stdEntitlementList)
        .stdAccountDiscoverSchema(stdAccountDiscoverSchema)
}
