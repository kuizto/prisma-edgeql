import { connect } from '@planetscale/database'
import type { Connection, ExecutedQuery } from '@planetscale/database'
import type {
    DeleteQuery,
    FindManyQuery,
    PrismaData,
    PrismaSelect,
    PrismaWhere,
    UpdateQuery,
    UpsertQuery,
    CreateQuery
} from '../prisma'
import type {
    PrismaEdgeDriverClass,
    ModelRelationParams,
    DriverParams,
    Model,
    ModelWithName,
    Operations
} from '../index'
import { parse } from '../gql'

export default class PlanetScale implements PrismaEdgeDriverClass<ExecutedQuery> {
    private config: DriverParams
    private conn?: Connection

    constructor(config: DriverParams) {
        this.config = config
        return this
    }

    public async execute(sql: string, vars: any[]): Promise<ExecutedQuery> {
        if (!this.conn) {
            this.conn = connect({
                url: this.config.databaseUrl,
                // https://github.com/planetscale/database-js/pull/102
                fetch: (input: string, init?: RequestInit) => {
                    delete (init as any)["cache"]
                    return fetch(input, init)
                }
            })
            this.config?.logger?.('new connection to PlanetScale', 'info')
        }

        let executed

        try {
            this.config?.logger?.('Execute SQL', 'info')
            executed = await this.conn.execute(sql, vars)
            this.config?.logger?.(`executed in ${Math.round(executed.time)} ms`, 'info')
        } catch (e) {
            this.config?.logger?.(e, 'error')
        }

        return executed
    }

    public formatOutput<T>(data: ExecutedQuery, opts?: { type?: 'one' | 'many' }): T {
        const first = data.rows?.[0]
        const transformed = first?.[Object.keys(first)?.[0]]

        return opts?.type === 'one' ? (transformed || {}) as T : (transformed || []) as T
    }

    private sqlWhere(
        table: string,
        prismaWhere: object,
        whereParams: { parentField?: string; statements?: string[]; model: ModelWithName },
    ): { statements: string[]; vars: any[]; joins: string[] } {
        const statements = whereParams?.statements || []
        const model = whereParams.model

        let whereStatements: string[] = []
        let vars: any[] = []
        let joins: any[] = []

        for (const field in prismaWhere) {
            const value = prismaWhere?.[field]
            const modelConfig = this.config?.models?.[model.name]
            const equality = typeof modelConfig?.transform?.write?.[field] !== 'undefined'
                ? modelConfig.transform?.write?.[field]('?')
                : '?'

            if (typeof value === 'object') {
                if (!whereParams?.parentField ||
                    (whereParams?.parentField && modelConfig?.relations?.[whereParams.parentField])
                ) {
                    let parentField = field

                    if (whereParams?.parentField && modelConfig?.relations?.[whereParams.parentField]) {
                        const relation = modelConfig.relations[whereParams.parentField]
                        parentField = `${relation.to[0]}.${field}`
                        joins.push(`LEFT JOIN\n  ${relation.to[0]} ON ${relation.to[0]}.${relation.to[1]} = ${relation.from[0]}.${relation.from[1]}`)
                    }

                    const child = this.sqlWhere(table, value, {
                        parentField,
                        statements: [],
                        model
                    })

                    vars = [...vars, ...child.vars]
                    whereStatements = [...whereStatements, ...child.statements]
                    joins = [...joins, ...child.joins]
                }
            }
            else if (['string', 'number', 'bigint', 'boolean'].includes(typeof value)) {
                if (field === 'contains' && whereParams?.parentField) {
                    whereStatements.push(`${whereParams.parentField} LIKE "%${equality}%"`)
                    vars.push(value)
                }
                else if (field === 'equals' && whereParams?.parentField) {
                    whereStatements.push(`${whereParams.parentField} = ${equality}`)
                    vars.push(value)
                }
                else if (field === 'lt' && whereParams?.parentField) {
                    whereStatements.push(`${whereParams.parentField} < ${equality}`)
                    vars.push(value)
                }
                else if (field === 'lte' && whereParams?.parentField) {
                    whereStatements.push(`${whereParams.parentField} <= ${equality}`)
                    vars.push(value)
                }
                else if (field === 'gt' && whereParams?.parentField) {
                    whereStatements.push(`${whereParams.parentField} > ${equality}`)
                    vars.push(value)
                }
                else if (field === 'gte' && whereParams?.parentField) {
                    whereStatements.push(`${whereParams.parentField} >= ${equality}`)
                    vars.push(value)
                }
                else {
                    whereStatements.push(`${field} = ${equality}`)
                    vars.push(prismaWhere[field])
                }
            }
            else if (typeof value === 'function') {
                whereStatements.push(`${field} = ${equality}`)
                vars.push(value)
            }
        }

        if (whereParams?.parentField)
            statements.push(`${whereStatements.filter(Boolean).join(' AND ')}`)
        else
            statements.push(`  ${whereStatements.filter(Boolean).join(' AND ')}`)

        return { statements, vars, joins }
    }

    private sqlSelect(
        prismaSelect: object,
        selectParams: { parentField?: string; relation?: ModelRelationParams; statements?: string[]; type?: 'one' | 'many'; model?: ModelWithName },
    ): { statements: string[] } {
        const statements = selectParams?.statements || []
        const type = selectParams?.type || 'many'
        const model = selectParams?.model

        const selectRelation = selectParams?.relation
        const modelConfig = model?.name && this.config?.models?.[model.name]
            ? { ...this.config.models[model.name], name: model.name }
            : undefined

        if (selectRelation) {
            statements.push(`    "${selectParams.parentField}", (SELECT ${selectRelation.type === 'one' ? 'JSON_OBJECT(' : 'JSON_ARRAYAGG(JSON_OBJECT('}`)
        } else {
            statements.push('SELECT')
            statements.push(type === 'one' ? '  JSON_OBJECT(' : '  JSON_ARRAYAGG(JSON_OBJECT(')
        }

        let selectStatements: string[] = []

        for (const field in prismaSelect) {
            const value = prismaSelect?.[field]

            if (typeof value === 'object' && value?.select) {
                if (selectParams?.parentField) {
                    const parentModelConfig: Model | undefined =
                        this.getRelationModelConfig(modelConfig, selectParams.parentField)

                    const child = this.sqlSelect(value.select, {
                        parentField: field,
                        relation: parentModelConfig?.relations?.[field],
                        statements: [],
                        type,
                        model
                    })

                    selectStatements = [...selectStatements, ...child.statements]
                } else {
                    const child = this.sqlSelect(value.select, {
                        parentField: field,
                        relation: modelConfig?.relations?.[field],
                        statements: [],
                        type,
                        model
                    })

                    selectStatements = [...selectStatements, ...child.statements]
                }
            }
            else if (value === true) {
                const transformedField = model?.name &&
                    typeof this.config?.models?.[model.name]?.transform?.read?.[field] !== 'undefined'
                    ? this.config.models[model.name].transform?.read?.[field](field)
                    : field

                if (selectRelation) {
                    selectStatements.push(`      "${field}", ${transformedField}`)
                } else {
                    selectStatements.push(`    "${field}", ${transformedField}`)
                }
            }
            else if (typeof value === 'string') {
                const transformedField = model?.name &&
                    typeof this.config?.models?.[model.name]?.transform?.read?.[field] !== 'undefined'
                    ? this.config.models[model.name].transform?.read?.[field](value)
                    : value

                selectStatements.push(`    "${field}", ${transformedField}`)
            }
        }

        if (selectRelation) {
            const relationFrom = `FROM ${selectRelation.to[0]} WHERE ${selectRelation.to[0]}.${selectRelation.to[1]} = ${selectRelation.from[0]}.${selectRelation.from[1]}`
            statements.push(selectStatements.join(',\n'))
            statements.push(selectRelation.type === 'one' ? `    ) ${relationFrom} )` : `    )) ${relationFrom} )`)
        }
        else {
            statements.push(selectStatements.join(',\n'))
            statements.push(type === 'one' ? '  )' : '  ))')
        }

        return { statements: [statements.join('\n')] }
    }

    private getModelConfigFromTable(table: string): ModelWithName | undefined {
        if (!table) return undefined

        let modelConfig: ModelWithName | undefined = undefined

        for (const key in this.config.models) {
            const config = this.config.models[key]

            if (config.table === table) {
                modelConfig = { ...config, name: key }
                break;
            }
        }

        return modelConfig
    }

    private getRelationModelConfig(
        modelConfig: ModelWithName | undefined,
        relationField: string
    ): ModelWithName | undefined {
        if (!modelConfig) return undefined

        const relationTable = modelConfig?.relations?.[relationField]?.to?.[0]
        let relationModelConfig: ModelWithName | undefined = undefined

        for (const key in this.config.models) {
            const relationConfig = this.config.models[key]

            if (relationConfig.table === relationTable) {
                relationModelConfig = { ...relationConfig, name: key }
                break;
            }
        }

        return relationModelConfig
    }

    private queryBuilder(baseModel?: ModelWithName) {
        const _this = this

        let statement: string[] = []
        let vars: any[] = []
        let joins: any[] = []
        let model: ModelWithName | undefined = baseModel

        function exec() {
            const sql = [statement.join('\n')]

            if (joins.length > 0) sql.push(joins.join('\n'))

            return { sql: `${sql.join('\n')};`, vars }
        }

        function where(prismaWhere: PrismaWhere) {
            if (prismaWhere && model) {
                const where = _this.sqlWhere(
                    model.table, prismaWhere || {}, { model, statements: ['WHERE'] },
                )
                statement = [...statement, ...where.statements]
                vars = [...vars, ...where.vars]
                joins = [...joins, ...where.joins]
            }

            return { exec }
        }

        function from(table: string) {
            model = _this.getModelConfigFromTable(table)
            statement = [...statement, `FROM\n  ${table}`]

            return { where, exec }
        }

        function deleteFrom(table: string) {
            model = _this.getModelConfigFromTable(table)
            statement = [...statement, `DELETE FROM\n  ${table}`]

            return { where }
        }

        function select(prismaSelect: PrismaSelect, type: 'one' | 'many') {
            if (prismaSelect) {
                const select = _this.sqlSelect(
                    prismaSelect || {}, { statements: [], type, model },
                )
                statement = [...statement, ...select.statements]
            }

            return { from, exec }
        }

        function set(prismaData: PrismaData) {
            if (prismaData && model) {
                const sqlSet: string[] = []
                for (const field in prismaData) {
                    const transformedField
                        = typeof _this.config?.models?.[model.name]?.transform?.write?.[field] !== 'undefined'
                            ? _this.config.models[model.name].transform?.write?.[field]('?') || '?'
                            : '?'
                    sqlSet.push(`  ${field} = ${transformedField}`)
                    vars.push(prismaData[field])
                }
                statement = [...statement, `SET\n${sqlSet.join(',\n')}`]
            }

            return { where }
        }

        function update(table: string) {
            statement = [...statement, `UPDATE\n  ${table}`]

            return { set }
        }

        function insertInto(table: string, columns: string[]) {
            if (columns.length > 0) {
                statement = [
                    ...statement,
                    `INSERT INTO \n ${table}(${columns.join(', ')})`
                ]
            }

            return { values }
        }

        function values(prismaData: PrismaData) {
            if (prismaData && model) {
                const sqlValues: string[] = []
                for (const field in prismaData) {
                    if (typeof prismaData[field] !== 'object') {
                        const transformedField
                            = typeof _this.config?.models?.[model.name]?.transform?.write?.[field] !== 'undefined'
                                ? _this.config.models[model.name].transform?.write?.[field]('?') || '?'
                                : '?'
                        sqlValues.push(transformedField)
                        vars.push(prismaData[field])
                    }
                }
                statement = [...statement, `VALUES(\n${sqlValues.join(', ')}\n)`]
            }

            return { exec }
        }

        return {
            insertInto,
            deleteFrom,
            update,
            select,
        }
    }

    public findUnique(queryParams: FindManyQuery, model: ModelWithName, log: boolean = true) {
        const ops: Operations = [
            this.queryBuilder(model)
                .select(queryParams.select, 'one')
                .from(model.table)
                .where(queryParams.where || null)
                .exec(),
        ]

        if (log) this.log('findUnique', ops)

        return ops
    }

    public findMany(queryParams: FindManyQuery, model: ModelWithName, log: boolean = true) {
        const ops: Operations = [
            this.queryBuilder(model)
                .select(queryParams.select, 'many')
                .from(model.table)
                .where(queryParams.where || null)
                .exec(),
        ]

        if (log) this.log('FindMany', ops)

        return ops
    }

    public create(queryParams: CreateQuery, model: ModelWithName, log: boolean = true) {
        const beforeInsert: Operations = []
        const primaryKeyField = model?.primaryKey?.column
        const primaryKeyDefaultValue = model?.primaryKey?.default?.toLowerCase()?.replace(/\s/g, '')

        let selectLastInsertIdWhere: any = { id: 'LAST_INSERT_ID()' };
        let selectLastSetVars: string[][] = [];

        ['uuid_to_bin(uuid())', 'uuid_to_bin(uuid(),0)', 'uuid_to_bin(uuid(),1)'].forEach(def => {
            if (primaryKeyDefaultValue?.includes(def)) {
                beforeInsert.push({
                    ...this.queryBuilder(model)
                        .select({ [primaryKeyField]: def }, 'one')
                        .exec(),
                    __execParams: {
                        after: ({ storage, result }) => storage['insertId'] = result?.[primaryKeyField]
                    }
                })
                selectLastInsertIdWhere = { [primaryKeyField]: `:${primaryKeyField}` }
                selectLastSetVars.push([`:${primaryKeyField}`, 'insertId'])
            }
        })

        for (const field of Object.keys(queryParams?.data || {})) {
            const value = queryParams?.data?.[field]

            if (typeof value === 'object' && typeof value?.connect === 'object') {
                const relationModel = this.getRelationModelConfig(model, field)
                const relationSelect = parse('select', value?.connect)

                if (
                    relationModel &&
                    queryParams.data &&
                    typeof model?.relations?.[field]?.from?.[1] === 'string' &&
                    typeof model?.relations?.[field]?.to?.[1] === 'string'
                ) {
                    const relationField = model?.relations?.[field]?.to?.[1]
                    const relationWhere = parse('where', {
                        where: {
                            [relationField]: value.connect?.[relationField]
                        }
                    })

                    beforeInsert.push(
                        this.queryBuilder(relationModel)
                            .select(relationSelect, 'one')
                            .from(relationModel.table)
                            .where(relationWhere)
                            .exec()
                    )

                    delete queryParams.data?.[field]

                    queryParams.data[
                        model.relations[field].from[1]
                    ] = relationWhere[relationField]
                }
            }
        }

        const ops: Operations = [
            ...beforeInsert,
            this.queryBuilder(model)
                .insertInto(model.table, Object.keys(queryParams?.data || {}))
                .values(queryParams.data)
                .exec(),
            {
                ...this.queryBuilder(model)
                    .select(queryParams.select, 'one')
                    .from(model.table)
                    .where(selectLastInsertIdWhere)
                    .exec(),
                __execParams: {
                    before: ({ storage, setVar }) => {
                        selectLastSetVars.forEach(([varKey, storageKey]) => {
                            if (storage?.[storageKey]) setVar(varKey, storage[storageKey])
                        })
                    },
                }
            }
        ]

        if (log) this.log('Create', ops)

        return ops
    }

    public update(queryParams: UpdateQuery, model: ModelWithName, log: boolean = true) {
        const ops: Operations = [
            this.queryBuilder(model)
                .update(model.table)
                .set(queryParams.data)
                .where(queryParams.where)
                .exec(),
            this.queryBuilder(model)
                .select(queryParams.select, 'one')
                .from(model.table)
                .where(queryParams.where || null)
                .exec(),
        ]

        if (log) this.log('Update', ops)

        return ops
    }

    public upsert(queryParams: UpsertQuery, model: ModelWithName, log: boolean = true) {
        const tryUpdateQuery = {
            ...this.queryBuilder(model)
                .update(model.table)
                .set(queryParams.update)
                .where(queryParams.where)
                .exec(),
            __execParams: {
                after: ({ storage, result }) => storage['update'] = result
            }
        }

        const createQueries = this.create({
            data: queryParams.create,
            select: queryParams.select,
        }, model, false)

        let index = 0

        for (const key in createQueries) {
            const query = createQueries?.[key]

            if (query) {
                if (!query?.__execParams) query['__execParams'] = {}
                query['__execParams']['if'] = ({ storage }) => !Boolean(storage?.['update'])
            }

            index++
        }

        const selectUpdatedQuery = {
            ...this.queryBuilder(model)
                .select(queryParams.select, 'one')
                .from(model.table)
                .where(queryParams.where || null)
                .exec(),
            __execParams: {
                if: ({ storage }) => Boolean(storage?.['update'])
            }
        }

        const ops: Operations = [
            tryUpdateQuery,
            ...createQueries,
            selectUpdatedQuery
        ]

        if (log) this.log('Upsert', ops)

        return ops
    }

    public delete(queryParams: DeleteQuery, model: ModelWithName, log: boolean = true) {
        const ops: Operations = [
            this.queryBuilder(model)
                .select(queryParams.select, 'one')
                .from(model.table)
                .where(queryParams.where || null)
                .exec(),
            this.queryBuilder(model)
                .deleteFrom(model.table)
                .where(queryParams.where)
                .exec(),
        ]

        if (log) this.log('Delete', ops)

        return ops
    }

    private log(label: string, ops: Operations) {
        this.config?.logger?.(`Prepare ${label} SQL statement(s)`, 'info')

        ops.forEach(({ sql, vars }) => {
            this.config?.logger?.(sql, 'debug')
            if (vars.length > 0)
                this.config?.logger?.(vars, 'debug')
        })
    }
}
