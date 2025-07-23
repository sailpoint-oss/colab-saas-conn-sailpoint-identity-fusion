import { CommandHandler, ConnectorError, createConnector } from '@sailpoint/connector-sdk'
const KEEPALIVE = 2.5 * 60 * 1000

const proxy: CommandHandler = async (context, input, res) => {
    const interval = setInterval(() => {
        res.keepAlive()
    }, KEEPALIVE)
    try {
        const config = await context.reloadConfig()
        const body = {
            type: context.commandType,
            input,
            config,
        }
        const response = await fetch(config.proxy_url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        })
        const data = await response.text()
        for (const line in data.split('\n')) {
            res.send(JSON.parse(line))
        }
    } catch (error) {
        throw new ConnectorError(error instanceof Error ? error.message : 'Unknown error')
    } finally {
        clearInterval(interval)
    }
}

export const proxyConnector = async () => {
    return createConnector()
        .stdTestConnection(proxy)
        .stdAccountList(proxy)
        .stdAccountRead(proxy)
        .stdAccountCreate(proxy)
        .stdAccountUpdate(proxy)
        .stdAccountEnable(proxy)
        .stdAccountDisable(proxy)
        .stdAccountUnlock(proxy)
        .stdAccountDiscoverSchema(proxy)
        .stdChangePassword(proxy)
        .stdSourceDataDiscover(proxy)
        .stdSourceDataRead(proxy)
        .stdEntitlementRead(proxy)
        .stdEntitlementList(proxy)
}
