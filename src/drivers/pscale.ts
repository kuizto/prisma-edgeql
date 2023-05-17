import { connect } from '@planetscale/database'
import type { Connection, ExecutedQuery } from '@planetscale/database'
import type {
    DeleteQuery,
    FindManyQuery,
    CountQuery,
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

    public async execute(sql: string, vars?: object | any[] | null, opts?: { silentErrors?: boolean }): Promise<ExecutedQuery> {
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
            if (!opts?.silentErrors) {
                this.config?.logger?.(e, 'error')
                this.config?.logger?.(sql, 'debug')
                this.config?.logger?.(vars, 'debug')
            }
        }

        return executed
    }

    public formatOutput<T>(data: ExecutedQuery, opts?: { type?: 'one' | 'many', model?: Model }): T {
        const first = data?.rows?.[0]
        const isJSON = data?.rows?.length === 1 && typeof first?.[Object.keys(first)?.[0]] === 'object'

        const output = isJSON
            ? first[Object.keys(first)[0]] : opts?.type === 'one'
                ? first : data?.rows

        return opts?.type === 'one' ? (output || null) as T : (output || []) as T
    }

    private escape(statement: string) {
        if (statement.includes('.')) {
            return statement
        } else {
            return `\`${statement}\``
        }
    }

    private sqlWhere(
        table: string,
        prismaWhere: object,
        whereParams: { parentField?: string; statements?: string[]; model: Model },
    ): { statements: string[]; vars: any[]; joins: string[] } {
        const statements = whereParams?.statements || []
        const model = whereParams.model

        let whereStatements: string[] = []
        let vars: any[] = []
        let joins: any[] = []

        for (const field in prismaWhere) {
            const value = prismaWhere?.[field]
            const modelConfig = this.config?.models?.[model.name]
            const equality = modelConfig?.columns?.[field]?.sqlIn('?') || '?'

            if (typeof value === 'object' && !(value instanceof Date)) {
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
            else if (value instanceof Date || ['string', 'number', 'bigint', 'boolean'].includes(typeof value)) {
                if (field === 'contains' && whereParams?.parentField) {
                    whereStatements.push(`${this.escape(whereParams.parentField)} LIKE ${equality}`)
                    vars.push(`%${value}%`)
                }
                else if (field === 'equals' && whereParams?.parentField) {
                    whereStatements.push(`${this.escape(whereParams.parentField)} = ${equality}`)
                    vars.push(value)
                }
                else if (field === 'lt' && whereParams?.parentField) {
                    whereStatements.push(`${this.escape(whereParams.parentField)} < ${equality}`)
                    vars.push(value)
                }
                else if (field === 'lte' && whereParams?.parentField) {
                    whereStatements.push(`${this.escape(whereParams.parentField)} <= ${equality}`)
                    vars.push(value)
                }
                else if (field === 'gt' && whereParams?.parentField) {
                    whereStatements.push(`${this.escape(whereParams.parentField)} > ${equality}`)
                    vars.push(value)
                }
                else if (field === 'gte' && whereParams?.parentField) {
                    whereStatements.push(`${this.escape(whereParams.parentField)} >= ${equality}`)
                    vars.push(value)
                }
                else {
                    whereStatements.push(`${this.escape(field)} = ${equality}`)
                    vars.push(prismaWhere[field])
                }
            }
            else if (typeof value === 'function') {
                whereStatements.push(`${this.escape(field)} = ${equality}`)
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
        selectParams: { parentField?: string; relation?: ModelRelationParams; statements?: string[]; type?: 'one' | 'many'; model?: Model },
    ): { statements: string[] } {
        const statements = selectParams?.statements || []
        const type = selectParams?.type || 'many'
        const model = selectParams?.model

        const selectRelation = selectParams?.relation
        const modelConfig = this.config?.models?.[model?.name || '__undefined'] || undefined

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
                const transformedField = this.config.models[model?.name || '__undefined']?.columns?.[field]?.sqlOut(field) || field

                if (selectRelation) {
                    selectStatements.push(`      "${field}", ${transformedField}`)
                } else {
                    selectStatements.push(`    "${field}", ${transformedField}`)
                }
            }
            else if (typeof value === 'string') {
                const transformedField = this.config.models[model?.name || '__undefined']?.columns?.[field]?.sqlOut(value) || value

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

    private getModelConfigFromTable(table: string): Model | undefined {
        if (!table) return undefined

        let modelConfig: Model | undefined = undefined

        for (const key in this.config.models) {
            const config = this.config.models[key]

            if (config.table === table) {
                modelConfig = config
                break;
            }
        }

        return modelConfig
    }

    private getRelationModelConfig(
        modelConfig: Model | undefined,
        relationField: string
    ): Model | undefined {
        if (!modelConfig) return undefined

        const relationTable = modelConfig?.relations?.[relationField]?.to?.[0]
        let relationModelConfig: Model | undefined = undefined

        for (const key in this.config.models) {
            const relationConfig = this.config.models[key]

            if (relationConfig.table === relationTable) {
                relationModelConfig = { ...relationConfig, name: key }
                break;
            }
        }

        return relationModelConfig
    }

    private queryBuilder(baseModel?: Model) {
        const _this = this

        let statement: string[] = []
        let vars: any[] = []
        let joins: any[] = []
        let model: Model | undefined = baseModel

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

            return { limit, exec }
        }

        function from(table: string) {
            model = _this.getModelConfigFromTable(table)
            statement = [...statement, `FROM\n  ${table}`]

            return { where, exec }
        }

        function limit(offset: number, rowCount?: number) {
            const useRowCount = typeof rowCount !== 'undefined'

            if (offset > 0 || useRowCount) {
                statement = [...statement, `LIMIT\n  ${offset}, ${rowCount}`]
            }

            return { exec }
        }

        function deleteFrom(table: string) {
            model = _this.getModelConfigFromTable(table)
            statement = [...statement, `DELETE FROM\n  ${table}`]

            return { where }
        }

        function select(prismaSelect: PrismaSelect | string, type: 'one' | 'many') {
            if (prismaSelect === '*') {
                statement = [...statement, `SELECT ${model?.selectAll || '*'}`]
            }
            else if (typeof prismaSelect === 'string') {
                statement = [...statement, `SELECT ${prismaSelect}`]
            }
            else if (prismaSelect) {
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
                    const transformedField = _this.config.models[model?.name || '__undefined']?.columns?.[field]?.sqlIn('?') || '?'
                    sqlSet.push(`  ${_this.escape(field)} = ${transformedField}`)
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
                    `INSERT INTO \n ${table}(${columns.map(c => `${_this.escape(c)}`).join(', ')})`
                ]
            }

            return { values }
        }

        function values(prismaData: PrismaData) {
            if (prismaData && model) {
                const sqlValues: string[] = []
                for (const field in prismaData) {
                    if (prismaData[field] instanceof Date || typeof prismaData[field] !== 'object') {
                        const transformedField = _this.config.models[model?.name || '__undefined']?.columns?.[field]?.sqlIn('?') || '?'
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

    public findUnique(queryParams: FindManyQuery, model: Model, log: boolean = true) {
        const ops: Operations = [
            this.queryBuilder(model)
                .select(queryParams?.select || '*', 'one')
                .from(model.table)
                .where(queryParams?.where || null)
                .limit(queryParams?.skip || 0, queryParams?.take)
                .exec(),
        ]

        if (log) this.log('findUnique', ops)

        return ops
    }

    public findMany(queryParams: FindManyQuery, model: Model, log: boolean = true) {
        const ops: Operations = [
            this.queryBuilder(model)
                .select(queryParams?.select || '*', 'many')
                .from(model.table)
                .where(queryParams?.where || null)
                .limit(queryParams?.skip || 0, queryParams?.take)
                .exec(),
        ]

        if (log) this.log('FindMany', ops)

        return ops
    }

    public count(queryParams: CountQuery, model: Model, log: boolean = true) {
        const ops: Operations = [
            this.queryBuilder(model)
                .select('COUNT(*)', 'one')
                .from(model.table)
                .where(queryParams?.where || null)
                .limit(queryParams?.skip || 0, queryParams?.take)
                .exec(),
        ]

        if (log) this.log('FindMany', ops)

        return ops
    }

    public create(queryParams: CreateQuery, model: Model, log: boolean = true) {
        const beforeInsert: Operations = []
        const primaryKeyField = model?.primaryKey

        let selectLastInsertIdWhere: any = {};
        let selectLastSetVars: string[][] = [];

        if (model?.columns?.[primaryKeyField]?.type === 'Binary(16)') {
            const sqlSelect = model?.columns?.[primaryKeyField]?.sqlIn('uuid()') || primaryKeyField

            beforeInsert.push({
                ...this.queryBuilder(model)
                    .select({ [primaryKeyField]: sqlSelect }, 'one')
                    .exec(),
                __execParams: {
                    after: ({ storage, result }) => storage['insertId'] = result?.[primaryKeyField]
                }
            })
            selectLastInsertIdWhere = { [primaryKeyField]: `:${primaryKeyField}` }
            selectLastSetVars.push([`:${primaryKeyField}`, 'insertId'])
        } else {
            beforeInsert.push({
                ...this.queryBuilder(model)
                    .select({ [primaryKeyField]: 'LAST_INSERT_ID()' }, 'one')
                    .exec(),
                __execParams: {
                    after: ({ storage, result }) => storage['insertId'] = result?.[primaryKeyField]
                }
            })
            selectLastInsertIdWhere = { [primaryKeyField]: `:${primaryKeyField}` }
            selectLastSetVars.push([`:${primaryKeyField}`, 'insertId'])
        }

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
                    .select(queryParams?.select || '*', 'one')
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

    public update(queryParams: UpdateQuery, model: Model, log: boolean = true) {
        const ops: Operations = [
            this.queryBuilder(model)
                .update(model.table)
                .set(queryParams.data)
                .where(queryParams.where)
                .exec(),
            this.queryBuilder(model)
                .select(queryParams?.select || '*', 'one')
                .from(model.table)
                .where(queryParams.where || null)
                .exec(),
        ]

        if (log) this.log('Update', ops)

        return ops
    }

    public upsert(queryParams: UpsertQuery, model: Model, log: boolean = true) {
        const tryUpdateQuery = {
            ...this.queryBuilder(model)
                .update(model.table)
                .set(queryParams.update)
                .where(queryParams.where)
                .exec(),
            __execParams: {
                after: ({ storage, result }) => storage['update'] = result,
                silentErrors: () => true
            }
        }

        const createQueries = this.create({
            data: queryParams.create,
            select: queryParams.select,
        }, model, false)

        for (const key in createQueries) {
            const query = createQueries?.[key]

            if (query) {
                if (!query?.__execParams) query['__execParams'] = {}
                query['__execParams']['if'] = ({ storage }) => !Boolean(storage?.['update'])
                query['__execParams']['silentErrors'] = ({ storage }) => !Boolean(storage?.['update'])
            }
        }

        const selectUpdatedQuery = {
            ...this.queryBuilder(model)
                .select(queryParams?.select || '*', 'one')
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

    public delete(queryParams: DeleteQuery, model: Model, log: boolean = true) {
        const ops: Operations = [
            this.queryBuilder(model)
                .select(queryParams?.select || '*', 'one')
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
