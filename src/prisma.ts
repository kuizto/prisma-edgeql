import type { AdapterParams, Client, Model } from './types'

export default class Prisma {
    private config: AdapterParams

    constructor(config: AdapterParams) {
        this.config = config
        return this
    }

    public client(): Client<string> {
        const client: Client<string> = {}

        for (const key in this.config.models) {
            const model: Model = this.config.models[key]

            client[key] = {
                findUnique: (args: any) => this.executeQuery('findUnique', 'one', args, model),
                findMany: (args: any) => this.executeQuery('findMany', 'many', args, model),
                count: (args: any) => this.executeQuery('count', 'one', args, model),
                create: (args: any) => this.executeQuery('create', 'one', args, model),
                update: (args: any) => this.executeQuery('update', 'one', args, model),
                upsert: (args: any) => this.executeQuery('upsert', 'one', args, model),
                delete: (args: any) => this.executeQuery('delete', 'one', args, model),
            }
        }

        return client
    }

    private async executeQuery<Args, Return>(
        driverQuery: 'findUnique' | 'findMany' | 'count' | 'update' | 'upsert' | 'create' | 'delete',
        returnType: 'one' | 'many',
        args: Args,
        model: Model,
    ): Promise<Return> {
        let querySelectedResult: any = null

        const ops = this.config.driver[driverQuery](args as any, model)
        const storage: any = {}

        for (let queryIndex = 0; queryIndex < ops.length; queryIndex++) {
            let { sql, vars, __execParams } = ops[queryIndex]

            const skip = typeof __execParams?.if !== 'undefined' && __execParams.if({ storage }) === false

            if (!skip) {
                let queryResult: any = null

                if (__execParams?.before) {
                    const setVar = (
                        key: string,
                        value: 'string' | 'number' | 'bigint' | 'boolean' | 'undefined' | null,
                    ) => vars = vars.map(v => v === key ? value : v)

                    __execParams.before({ storage, setVar })
                }

                const silentErrors = typeof __execParams?.silentErrors !== 'undefined' && __execParams.silentErrors({ storage }) === true
                const response = await this.config.driver.execute(sql, vars, { silentErrors })

                const setResult
                    = (driverQuery === 'delete' && queryIndex === 0)
                    || (driverQuery !== 'delete' && queryIndex === ops.length - 1)

                if (setResult || __execParams?.after) {
                    queryResult = this.config.driver.formatOutput<Return>(
                        response, { type: returnType, model },
                    )

                    if (__execParams?.after)
                        __execParams.after({ storage, result: queryResult })
                }

                querySelectedResult = queryResult
            }
        }

        return querySelectedResult
    }
}
