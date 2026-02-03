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

// Connector must be exported as module property named connector
export const connector = async () => {
    const config: FusionConfig = await safeReadConfig()
    //==============================================================================================================

    const stdTest: StdTestConnectionHandler = async (context, input, res) => {
        try {
            const serviceRegistry = new ServiceRegistry(config, context)
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
            logger.error(error)
            throw new ConnectorError('Failed to test connection', ConnectorErrorType.Generic)
        } finally {
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

        try {
            const serviceRegistry = new ServiceRegistry(config, context)
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
            logger.error(error)
            throw new ConnectorError('Failed to aggregate accounts', ConnectorErrorType.Generic)
        } finally {
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

        try {
            const serviceRegistry = new ServiceRegistry(config, context)
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
            logger.error(error)
            throw new ConnectorError(`Failed to read account ${input.identity}`, ConnectorErrorType.Generic)
        } finally {
            ServiceRegistry.clear()
        }
    }

    const stdAccountCreate: StdAccountCreateHandler = async (context, input, res) => {
        const isCustom = context.accountCreate !== undefined
        const isProxy = isProxyMode(config)
        const runMode = isCustom ? 'custom' : isProxy ? 'proxy' : 'default'

        try {
            const serviceRegistry = new ServiceRegistry(config, context)
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
            logger.error(error)
            throw new ConnectorError(
                `Failed to create account ${input.attributes.name ?? input.identity}`,
                ConnectorErrorType.Generic
            )
        } finally {
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

        try {
            const serviceRegistry = new ServiceRegistry(config, context)
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
            logger.error(error)
            throw new ConnectorError(`Failed to update account ${input.identity}`, ConnectorErrorType.Generic)
        } finally {
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

        try {
            const serviceRegistry = new ServiceRegistry(config, context)
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
            logger.error(error)
            throw new ConnectorError(`Failed to enable account ${input.identity}`, ConnectorErrorType.Generic)
        } finally {
            ServiceRegistry.clear()
        }
    }

    const stdAccountDisable: StdAccountDisableHandler = async (context, input, res) => {
        const isCustom = context.accountDisable !== undefined
        const isProxy = isProxyMode(config)
        const runMode = isCustom ? 'custom' : isProxy ? 'proxy' : 'default'

        try {
            const serviceRegistry = new ServiceRegistry(config, context)
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
            logger.error(error)
            throw new ConnectorError(`Failed to disable account ${input.identity}`, ConnectorErrorType.Generic)
        } finally {
            ServiceRegistry.clear()
        }
    }

    const stdEntitlementList: StdEntitlementListHandler = async (context, input, res) => {
        const isCustom = context.entitlementList !== undefined
        const isProxy = isProxyMode(config)
        const runMode = isCustom ? 'custom' : isProxy ? 'proxy' : 'default'

        try {
            const serviceRegistry = new ServiceRegistry(config, context)
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
            logger.error(error)
            throw new ConnectorError(`Failed to list entitlements for type ${input.type}`, ConnectorErrorType.Generic)
        } finally {
            ServiceRegistry.clear()
        }
    }

    const stdAccountDiscoverSchema: StdAccountDiscoverSchemaHandler = async (context, input, res) => {
        const isCustom = context.accountDiscoverSchema !== undefined
        const isProxy = isProxyMode(config)
        const runMode = isCustom ? 'custom' : isProxy ? 'proxy' : 'default'

        try {
            const serviceRegistry = new ServiceRegistry(config, context)
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
            logger.error(error)
            throw new ConnectorError('Failed to discover schema', ConnectorErrorType.Generic)
        } finally {
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
