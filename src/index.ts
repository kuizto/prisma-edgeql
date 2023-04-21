import GraphQL from './gql'
import PlanetScale from './drivers/pscale'
import Prisma from './prisma'
import type { Client, FindManyQuery, findUniqueQuery, UpdateQuery, DeleteQuery } from './prisma'

export { PlanetScale }

export default class PrismaEdgeQL<T extends PrismaEdgeQLParams> {
    public gql: (query: string, args?: any) => GraphQL
    public driver: Driver
    public prisma: Client<T['models']>

    constructor(params: PrismaEdgeQLParams) {
        this.driver = new params.driver({
            databaseUrl: params.databaseUrl,
            models: params?.models,
            logger: params?.logger,
        })

        const prisma = new Prisma({
            driver: this.driver,
            models: params?.models,
            logger: params?.logger,
        })

        this.gql = (query: string, args?: any) => new GraphQL(query, args)
        this.prisma = prisma.client()

        return this
    }
}

export type ModelWithName = Model & { name: string }
export type Models = { [name: string]: Model }
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

export type Model = {
    table: string
    primaryKey: { column: string; default: string }
    relations?: {
        [field: string]: ModelRelationParams
    }
    transform?: {
        read?: { [field: string]: (data: string) => string }
        write?: { [field: string]: (data: string) => string }
    }
}

export type PrismaEdgeQLParams = {
    driver: typeof PlanetScale
    databaseUrl: string
    models?: Models
    logger?: (msg: any, logLevel: 'debug' | 'info') => void
}

export type DriverParams = {
    databaseUrl: string
    models: PrismaEdgeQLParams['models']
    logger: PrismaEdgeQLParams['logger']
}

export type AdapterParams = {
    driver: Driver
    models: PrismaEdgeQLParams['models']
    logger: PrismaEdgeQLParams['logger']
}

export type PrismaEdgeDriverClass<DriverExecuteRes> = {
    execute: (sql: string, vars: any[]) => Promise<DriverExecuteRes>
    formatOutput: <T>(data: DriverExecuteRes, opts?: { type?: 'one' | 'many' }) => T
    findUnique: (queryParams: findUniqueQuery, model: ModelWithName) => Operations
    findMany: (queryParams: FindManyQuery, model: ModelWithName) => Operations
    update: (queryParams: UpdateQuery, model: ModelWithName) => Operations
    delete: (queryParams: DeleteQuery, model: ModelWithName) => Operations
}
