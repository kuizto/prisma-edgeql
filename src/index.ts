import GraphQL from './gql'
import PlanetScale from './drivers/pscale'
import Prisma, { Client } from './prisma'
import type {
    FindManyQuery,
    FindUniqueQuery,
    UpdateQuery,
    DeleteQuery
} from './prisma'

export { PlanetScale }

export default class PrismaEdgeQL<T extends PrismaEdgeQLParams> {
    public gql: (query: string, args?: any) => GraphQL
    public driver: Driver
    public prisma: Client<keyof T['prismaModels'] extends string ? keyof T['prismaModels'] : string>

    constructor(params: T) {
        const models: Models = makeModels(params?.prismaModels)

        this.driver = new params.driver({
            databaseUrl: params.databaseUrl,
            models,
            logger: params?.logger,
        })

        const prisma = new Prisma({
            driver: this.driver,
            models,
            logger: params?.logger,
        })

        this.gql = (query: string, args?: any) => new GraphQL(query, args)
        this.prisma = prisma.client()

        return this
    }
}

export function makeModels(prismaModels: PrismaEdgeQLParams['prismaModels']) {
    const models: Models = {}

    if (prismaModels) {
        for (let modelIdx = 0; modelIdx < Object.keys(prismaModels).length; modelIdx++) {
            const table = Object.keys(prismaModels)[modelIdx]
            const name = table.toLowerCase()
            const model = prismaModels?.[table] || {}
            const relations = model?.relations || {}
            const columns = {}
            const selectAll: string[] = ['*']

            let primaryKey: string | undefined = undefined

            if (model?.fields) {
                for (let fieldIdx = 0; fieldIdx < Object.keys(model.fields).length; fieldIdx++) {
                    const column = Object.keys(model.fields)[fieldIdx]
                    const defaultValue = model.fields[column]?.default || ''
                    const isIdField = model.fields[column]?.id
                    const uuidToBinary16 = /uuid_to_bin\(uuid\(\)(?:,\s*([10]))*\)/gi.exec(defaultValue) || {};

                    if (uuidToBinary16) {
                        const type = 'Binary(16)'
                        const swapFlag = uuidToBinary16?.[1] || '0'
                        const sqlIn = (d) => `UUID_TO_BIN(${d}, ${swapFlag})`
                        const sqlOut = (d) => `BIN_TO_UUID(${d}, ${swapFlag})`
                        selectAll.push(`${sqlOut(column)} as ${column}`)

                        columns[column] = {
                            type,
                            sqlIn,
                            sqlOut,
                        }
                    }

                    if (isIdField) {
                        primaryKey = column
                    }
                }
            }

            if (!primaryKey) {
                throw new Error(`Missing 'id' field for 'prismaModel.${table}'.`)
            }

            models[name] = {
                name,
                primaryKey,
                table,
                columns,
                relations,
                selectAll: selectAll.join(', ')
            }
        }
    }

    return models
}

export type Driver = InstanceType<PrismaEdgeQLParams['driver']>

export type ExecParams = {
    if?: ({ storage }) => any;
    before?: ({ storage, setVar }) => any;
    after?: ({ storage, result }) => any
}

export type Operations = {
    sql: string;
    vars: any[];
    __execParams?: ExecParams
}[]

export type ModelRelationParams = {
    type: 'one' | 'many'
    from: string[]
    to: string[]
}

export type ModelFieldParams = {
    default?: string,
    id?: boolean
}

export type PrismaModels = {
    [name: string]: {
        fields?: {
            [field: string]: ModelFieldParams
        }
        relations?: {
            [field: string]: ModelRelationParams
        }
    }
}

export type Model = {
    name: string,
    table: string,
    primaryKey: string,
    columns: {
        [column: string]: {
            type: string,
            sqlIn: (data: any) => any,
            sqlOut: (data: any) => any,
        }
    },
    relations: {
        [field: string]: ModelRelationParams
    },
    selectAll: string
}

export type Models = {
    [key: string]: Model
}

export type PrismaEdgeQLParams = {
    driver: typeof PlanetScale
    databaseUrl: string
    prismaModels?: PrismaModels
    logger?: (msg: any, logLevel: 'debug' | 'info' | 'error') => void
}

export type DriverParams = {
    databaseUrl: string
    models: Models
    logger: PrismaEdgeQLParams['logger']
}

export type AdapterParams = {
    driver: Driver
    models: Models
    logger: PrismaEdgeQLParams['logger']
}

export type PrismaEdgeDriverClass<DriverExecuteRes> = {
    execute: (sql: string, vars: any[]) => Promise<DriverExecuteRes>
    formatOutput: <T>(data: DriverExecuteRes, opts?: { type?: 'one' | 'many' }) => T
    findUnique: (queryParams: FindUniqueQuery, model: Model) => Operations
    findMany: (queryParams: FindManyQuery, model: Model) => Operations
    update: (queryParams: UpdateQuery, model: Model) => Operations
    delete: (queryParams: DeleteQuery, model: Model) => Operations
}
