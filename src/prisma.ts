import type { PrismaEdgeQLAdaperParams, PrismaEdgeQLModelWithName, PrismaEdgeQLModels } from './index'

export default class Prisma {
    private config: PrismaEdgeQLAdaperParams

    constructor(config: PrismaEdgeQLAdaperParams) {
        this.config = config

        return this
    }

    public client<Models extends PrismaEdgeQLModels | undefined>(): Client<Models> {
        const client: Client<Models> = {} as Client<Models>

        for (const model in this.config.models) {
            const modelConfig: PrismaEdgeQLModelWithName = {
                ...this.config.models[model],
                name: model,
            }

            client[model] = {
                findOne: <T>(queryParams: FindOneQuery) =>
                    this.findOne<T>(queryParams, modelConfig),
                findMany: <T>(queryParams: FindManyQuery) =>
                    this.findMany<T>(queryParams, modelConfig),
                update: <T>(queryParams: UpdateQuery) =>
                    this.update<T>(queryParams, modelConfig),
            }
        }

        return client
    }

    private async findOne<T>(queryParams: FindOneQuery, model: PrismaEdgeQLModelWithName): FindOneResponse<T> {
        let result: Awaited<FindOneResponse<T>> = null

        const ops = this.config.driver.findOne(queryParams, model)

        for (let i = 0; i < ops.length; i++) {
            const { sql, vars } = ops[i]
            const response = await this.config.driver.execute(sql, vars)

            if (i === ops.length - 1)
                result = this.config.driver.formatOutput<Awaited<FindOneResponse<T>>>(response, { type: 'one' })
        }

        return result
    }

    private async findMany<T>(queryParams: FindManyQuery, model: PrismaEdgeQLModelWithName): FindManyResponse<T> {
        let result: Awaited<FindManyResponse<T>> = []

        const ops = this.config.driver.findMany(queryParams, model)

        for (let i = 0; i < ops.length; i++) {
            const { sql, vars } = ops[i]
            const response = await this.config.driver.execute(sql, vars)

            if (i === ops.length - 1)
                result = this.config.driver.formatOutput<Awaited<FindManyResponse<T>>>(response, { type: 'many' })
        }

        return result
    }

    private async update<T>(queryParams: UpdateQuery, model: PrismaEdgeQLModelWithName): UpdateResponse<T> {
        let result: Awaited<UpdateResponse<T>> = null

        const ops = this.config.driver.update(queryParams, model)

        for (let i = 0; i < ops.length; i++) {
            const { sql, vars } = ops[i]
            const response = await this.config.driver.execute(sql, vars)

            if (i === ops.length - 1)
                result = this.config.driver.formatOutput<Awaited<UpdateResponse<T>>>(response, { type: 'one' })
        }

        return result
    }
}

export type Client<Models extends PrismaEdgeQLModels | undefined> = Record<keyof Models, {
    findOne: FindOne
    findMany: FindMany
    update: Update
}>

type FindOneResponse<T> = Promise<Partial<T> | null>
type FindManyResponse<T> = Promise<Partial<T>[]>
type UpdateResponse<T> = Promise<Partial<T> | null>

type FindOne = <T>(query: FindOneQuery) => FindOneResponse<T>
type FindMany = <T>(query: FindManyQuery) => FindManyResponse<T>
type Update = <T>(query: UpdateQuery) => UpdateResponse<T>

export type PrismaWhere = object | null
export type PrismaSelect = object | null
export type PrismaData = object | null

export interface FindOneQuery {
    where: PrismaWhere
    select: PrismaSelect
}

export interface FindManyQuery {
    where?: PrismaWhere
    select: PrismaSelect
}

export interface UpdateQuery {
    data: PrismaData
    where: PrismaWhere
    select: PrismaSelect
}
