import GraphQL from './gql'
import PlanetScale from './drivers/pscale'
import Prisma from './prisma'
import type { Client, FindManyQuery, FindOneQuery, UpdateQuery } from './prisma'

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

        const adapterParams: PrismaEdgeQLAdaperParams = {
            driver: this.driver,
            models: params?.models,
            logger: params?.logger,
        }

        const prisma = new Prisma(adapterParams)

        this.gql = (query: string, args?: any) => new GraphQL(query, args)
        this.prisma = prisma.client()

        return this
    }
}

export interface PrismaEdgeQLModel {
    table: string
    relations?: {
        [field: string]: {
            type: 'one' | 'many'
            from: string[]
            to: string[]
        }
    }
    transform?: {
        read?: {
            [field: string]: (data: string) => string
        }
        write?: {
            [field: string]: (data: string) => string
        }
    }
}

export type PrismaEdgeQLModelWithName = PrismaEdgeQLModel & {
    name: string
}

export interface PrismaEdgeQLModels {
    [name: string]: PrismaEdgeQLModel
}

export interface PrismaEdgeQLModelsWithName {
    [name: string]: PrismaEdgeQLModelWithName
}

export interface PrismaEdgeQLParams {
    driver: typeof PlanetScale
    databaseUrl: string
    models?: PrismaEdgeQLModels
    logger?: (msg: any, logLevel: 'debug' | 'info') => void
}

export type Driver = InstanceType<PrismaEdgeQLParams['driver']>

export interface PrismaEdgeQLDriverParams {
    databaseUrl: string
    models: PrismaEdgeQLParams['models']
    logger: PrismaEdgeQLParams['logger']
}

export interface PrismaEdgeQLAdaperParams {
    driver: Driver
    models: PrismaEdgeQLParams['models']
    logger: PrismaEdgeQLParams['logger']
}

export type PrismaEdgeSQLOps = { sql: string; vars: any[] }[]

export interface PrismaEdgeDriverClass<DriverExecuteRes> {
    execute: (sql: string, vars: any[]) => Promise<DriverExecuteRes>
    formatOutput: <T>(data: DriverExecuteRes, opts?: { type?: 'one' | 'many' }) => T
    findOne: (queryParams: FindOneQuery, model: PrismaEdgeQLModelWithName) => PrismaEdgeSQLOps
    findMany: (queryParams: FindManyQuery, model: PrismaEdgeQLModelWithName) => PrismaEdgeSQLOps
    update: (queryParams: UpdateQuery, model: PrismaEdgeQLModelWithName) => PrismaEdgeSQLOps
}
