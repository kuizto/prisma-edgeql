import type { AdapterParams, ModelWithName, Models } from './index'

export default class Prisma {
    private config: AdapterParams

    constructor(config: AdapterParams) {
        this.config = config
        return this
    }

    public client<T extends Models | undefined>(): Client<T> {
        const client: Client<T> = {} as Client<T>

        for (const model in this.config.models) {
            const modelConfig: ModelWithName = {
                ...this.config.models[model],
                name: model,
            }

            client[model] = {
                findUnique: <T>(queryParams: findUniqueQuery) =>
                    this.executeQuery<T, findUniqueQuery>(
                        'findUnique', 'one', queryParams, modelConfig
                    ),
                findMany: <T>(queryParams: FindManyQuery) =>
                    this.executeQuery<T, FindManyQuery>(
                        'findMany', 'many', queryParams, modelConfig
                    ),
                create: <T>(queryParams: CreateQuery) =>
                    this.executeQuery<T, CreateQuery>(
                        'create', 'one', queryParams, modelConfig
                    ),
                update: <T>(queryParams: UpdateQuery) =>
                    this.executeQuery<T, UpdateQuery>(
                        'update', 'one', queryParams, modelConfig
                    ),
                upsert: <T>(queryParams: UpsertQuery) =>
                    this.executeQuery<T, UpsertQuery>(
                        'upsert', 'one', queryParams, modelConfig
                    ),
                delete: <T>(queryParams: DeleteQuery) =>
                    this.executeQuery<T, DeleteQuery>(
                        'delete', 'one', queryParams, modelConfig
                    ),
            }
        }

        return client
    }

    private async executeQuery<T, QueryParams>(
        driverQuery: 'findUnique' | 'findMany' | 'update' | 'upsert' | 'create' | 'delete',
        returnType: 'one' | 'many',
        queryParams: QueryParams,
        model: ModelWithName,
    ): Promise<Partial<T> | null> {
        let querySelectedResult: any = null

        const ops = this.config.driver[driverQuery](queryParams as any, model)
        const storage: any = {}

        for (let queryIndex = 0; queryIndex < ops.length; queryIndex++) {
            let { sql, vars, __execParams } = ops[queryIndex]

            const skip = typeof __execParams?.if !== 'undefined' && __execParams.if({ storage }) === false

            if (!skip) {
                let queryResult: any = null

                if (__execParams?.before) {
                    const setVar = (
                        key: string,
                        value: "string" | "number" | "bigint" | "boolean" | "undefined" | null
                    ) => vars = vars.map(v => v === key ? value : v)

                    __execParams.before({ storage, setVar })
                }

                const response = await this.config.driver.execute(sql, vars)

                const setResult =
                    (driverQuery === 'delete' && queryIndex === 0) ||
                    (driverQuery !== 'delete' && queryIndex === ops.length - 1)

                if (setResult || __execParams?.after) {
                    queryResult = this.config.driver.formatOutput<Awaited<Promise<Partial<T> | null>>>(
                        response, { type: returnType }
                    )

                    if (__execParams?.after) {
                        __execParams.after({ storage, result: queryResult })
                    }
                }

                querySelectedResult = queryResult
            }
        }

        return querySelectedResult
    }
}

export type Client<T extends Models | undefined> = Record<keyof T, {
    findUnique: findUnique
    findMany: FindMany
    create: Create
    update: Update
    upsert: Upsert
    delete: Delete
}>

type findUnique = <T>(query: findUniqueQuery) => Promise<Partial<T> | null>
type FindMany = <T>(query: FindManyQuery) => Promise<Partial<T> | null>
type Create = <T>(query: CreateQuery) => Promise<Partial<T> | null>
type Update = <T>(query: UpdateQuery) => Promise<Partial<T> | null>
type Upsert = <T>(query: UpsertQuery) => Promise<Partial<T> | null>
type Delete = <T>(query: DeleteQuery) => Promise<Partial<T> | null>

export type PrismaCreate = object | null
export type PrismaUpdate = object | null
export type PrismaWhere = object | null
export type PrismaSelect = object | null
export type PrismaData = object | null

export type findUniqueQuery = {
    where: PrismaWhere
    select: PrismaSelect
}

export type FindManyQuery = {
    where?: PrismaWhere
    select: PrismaSelect
}

export type CreateQuery = {
    data: PrismaData
    select: PrismaSelect
}

export type UpdateQuery = {
    data: PrismaData
    where: PrismaWhere
    select: PrismaSelect
}

export type UpsertQuery = {
    where: PrismaWhere
    update: PrismaUpdate
    create: PrismaCreate
    select: PrismaSelect
}

export type DeleteQuery = {
    where: PrismaWhere
    select: PrismaSelect
}
