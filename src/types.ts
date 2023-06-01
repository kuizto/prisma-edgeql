/* eslint-disable @typescript-eslint/consistent-type-definitions */
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import PlanetScale from './drivers/pscale'

export type Driver = InstanceType<PrismaEdgeQLParams['driver']>

export type ExecParams = {
    if?: ({ storage }) => any
    before?: ({ storage, setVar }) => any
    after?: ({ storage, result }) => any
    silentErrors?: ({ storage }) => boolean
}

export type Operations = {
    sql: string
    vars: any[]
    __execParams?: ExecParams
}[]

export type ModelRelationParams = {
    type: 'one' | 'many'
    from: string[]
    to: string[]
}

export type ModelFieldParams = {
    default?: string
    type?: string
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
    name: string
    table: string
    primaryKey: string
    columns: {
        [column: string]: {
            autoIncrement?: boolean
            type: 'Binary(16)' | 'DateTime(3)' | 'Integer'
            sqlIn: (data: any) => any
            sqlOut: (data: any) => any
        }
    }
    relations: {
        [field: string]: ModelRelationParams
    }
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

export type Client<Model extends string> = Record<Lowercase<Model>, {
    findUnique: <Payload = any | null, Args = FindUniqueQuery>(args: FindUniqueQuery | Omit<Args, 'include' | 'cursor' | 'distinct'>) => Promise<Payload>
    findMany: <Payload = any, Args = FindManyQuery>(args?: FindManyQuery | Omit<Args, 'include' | 'cursor' | 'distinct'>) => Promise<Payload[]>
    count: <Payload = number, Args = CountQuery>(args?: CountQuery | Omit<Args, 'include' | 'cursor' | 'distinct'>) => Promise<Payload>
    create: <Payload = any | null, Args = CreateQuery>(args: CreateQuery | Omit<Args, 'include' | 'cursor' | 'distinct'>) => Promise<Payload>
    update: <Payload = any | null, Args = UpdateQuery>(args: UpdateQuery | Omit<Args, 'include' | 'cursor' | 'distinct'>) => Promise<Payload>
    upsert: <Payload = any | null, Args = UpsertQuery>(args: UpsertQuery | Omit<Args, 'include' | 'cursor' | 'distinct'>) => Promise<Payload>
    delete: <Payload = any | null, Args = DeleteQuery>(args: DeleteQuery | Omit<Args, 'include' | 'cursor' | 'distinct'>) => Promise<Payload>
}>

export type PrismaCreate = object | null
export type PrismaUpdate = object | null
export type PrismaWhere = object | null
export type PrismaSelect = object | null
export type PrismaData = object | null

export type FindUniqueQuery = {
    where: PrismaWhere
    select?: PrismaSelect
    skip?: number
    take?: number
}

export type FindManyQuery = {
    where?: PrismaWhere
    select?: PrismaSelect
    skip?: number
    take?: number
} | undefined

export type CountQuery = {
    where?: PrismaWhere
    select?: PrismaSelect
    skip?: number
    take?: number
} | undefined

export type CreateQuery = {
    data: PrismaData
    select?: PrismaSelect
}

export type UpdateQuery = {
    data: PrismaData
    where: PrismaWhere
    select?: PrismaSelect
}

export type UpsertQuery = {
    where: PrismaWhere
    update: PrismaUpdate
    create: PrismaCreate
    select?: PrismaSelect
}

export type DeleteQuery = {
    where: PrismaWhere
    select?: PrismaSelect
}
