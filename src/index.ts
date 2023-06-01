import GraphQL from './gql'
import PlanetScale from './drivers/pscale'
import Prisma from './prisma'
import type { Client, Driver, Models, PrismaEdgeQLParams } from './types'

export { PlanetScale }
export type { PrismaEdgeQLParams }

export default class PrismaEdgeQL<T extends PrismaEdgeQLParams> {
    public gql: (query: string, args?: any) => GraphQL
    public driver: Driver
    public prisma: Client<keyof T['prismaModels'] extends string ? keyof T['prismaModels'] : string>
    public models: Models

    constructor(params: T) {
        this.models = makeModels(params?.prismaModels)

        // eslint-disable-next-line new-cap
        this.driver = new params.driver({
            databaseUrl: params.databaseUrl,
            models: this.models,
            logger: params?.logger,
        })

        const prisma = new Prisma({
            driver: this.driver,
            models: this.models,
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

            let primaryKey: string | undefined

            if (model?.fields) {
                for (let fieldIdx = 0; fieldIdx < Object.keys(model.fields).length; fieldIdx++) {
                    const column = Object.keys(model.fields)[fieldIdx]
                    const defaultValue = model.fields[column]?.default || ''
                    const type = model.fields[column]?.type || ''
                    const isIdField = model.fields[column]?.id
                    const uuidToBinary16 = /uuid_to_bin\(uuid\(\)(?:,\s*([10]))*\)/gi.exec(defaultValue)
                    const autoIncrement = /autoincrement\(\)/gi.exec(defaultValue)

                    if (autoIncrement) {
                        const sqlIn = d => d
                        const sqlOut = d => d
                        columns[column] = {
                            autoIncrement: true,
                            type: 'Integer',
                            sqlIn,
                            sqlOut,
                        }
                        selectAll.push(`${sqlOut(column)} as ${column}`)
                    }

                    else if (uuidToBinary16 || type === '@db.Binary(16)') {
                        const swapFlag = uuidToBinary16?.[1] || '0'
                        const sqlIn = d => `UUID_TO_BIN(${d}, ${swapFlag})`
                        const sqlOut = d => `BIN_TO_UUID(${d}, ${swapFlag})`
                        columns[column] = {
                            type: 'Binary(16)',
                            sqlIn,
                            sqlOut,
                        }
                        selectAll.push(`${sqlOut(column)} as ${column}`)
                    }

                    else if (type === 'DateTime') {
                        const sqlIn = d => d
                        const sqlOut = d => `DATE_FORMAT(${d}, '%Y-%m-%dT%TZ')`
                        columns[column] = {
                            type: 'DateTime(3)',
                            sqlIn,
                            sqlOut,
                        }
                        selectAll.push(`${sqlOut(column)} as ${column}`)
                    }

                    if (isIdField)
                        primaryKey = column
                }
            }

            if (!primaryKey)
                throw new Error(`Missing 'id' field for 'prismaModel.${table}'.`)

            models[name] = {
                name,
                primaryKey,
                table,
                columns,
                relations,
                selectAll: selectAll.join(', '),
            }
        }
    }

    return models
}
