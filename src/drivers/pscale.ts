import { connect } from '@planetscale/database'
import type { Connection, ExecutedQuery } from '@planetscale/database'
import type { FindManyQuery, PrismaData, PrismaSelect, PrismaWhere, UpdateQuery } from '../prisma'
import type { PrismaEdgeDriverClass, PrismaEdgeQLDriverParams, PrismaEdgeQLModelWithName, PrismaEdgeSQLOps } from '../index'

export default class PlanetScale implements PrismaEdgeDriverClass<ExecutedQuery> {
    private config: PrismaEdgeQLDriverParams
    private conn?: Connection

    constructor(config: PrismaEdgeQLDriverParams) {
        this.config = config

        return this
    }

    public async execute(sql: string, vars: any[]): Promise<ExecutedQuery> {
        if (!this.conn) {
            this.conn = connect({ url: this.config.databaseUrl })
            this.config?.logger?.('new connection to PlanetScale', 'info')
        }

        this.config?.logger?.('Execute SQL', 'info')

        const executed = await this.conn.execute(sql, vars)
        this.config?.logger?.(`executed in ${Math.round(executed.time)} ms`, 'info')

        return executed
    }

    public formatOutput<T>(data: ExecutedQuery, opts?: { type?: 'one' | 'many' }): T {
        const first = data.rows?.[0]
        const transformed = first?.[Object.keys(first)?.[0]]

        if (opts?.type === 'one')
            return (transformed || {}) as T
        else
            return (transformed || []) as T
    }

    private sqlWhere(
        table: string,
        prismaWhere: object,
        whereParams: { parentField?: string; statements?: string[]; model: PrismaEdgeQLModelWithName },
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
                if (!whereParams?.parentField
                    || (whereParams?.parentField && modelConfig?.relations?.[whereParams.parentField])
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

                    vars = [
                        ...vars,
                        ...child.vars,
                    ]

                    whereStatements = [
                        ...whereStatements,
                        ...child.statements,
                    ]

                    joins = [
                        ...joins,
                        ...child.joins,
                    ]
                }
            }
            else if (['string', 'number', 'bigint', 'boolean'].includes(typeof value)) {
                if (field === 'contains' && whereParams?.parentField) {
                    whereStatements.push(`${whereParams.parentField} LIKE '%"${equality}"%'`)
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
        }

        if (whereParams?.parentField)
            statements.push(`${whereStatements.filter(Boolean).join(' AND ')}`)
        else
            statements.push(`  ${whereStatements.filter(Boolean).join(' AND ')}`)

        return { statements, vars, joins }
    }

    private sqlSelect(
        table: string,
        prismaSelect: object,
        selectParams: { parentField?: string; statements?: string[]; type?: 'one' | 'many'; model: PrismaEdgeQLModelWithName },
    ): { statements: string[] } {
        const statements = selectParams?.statements || []
        const type = selectParams?.type || 'many'
        const model = selectParams.model
        const modelConfig = this.config?.models?.[model.name]
        const selectRelation = (selectParams?.parentField && modelConfig?.relations?.[selectParams.parentField])
            ? modelConfig.relations[selectParams.parentField]
            : null

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
                const child = this.sqlSelect(table, value.select, {
                    parentField: field,
                    statements: [],
                    type,
                    model
                })

                selectStatements = [
                    ...selectStatements,
                    ...child.statements,
                ]
            }
            else if (value === true) {
                const transformedField
                    = typeof this.config?.models?.[model.name]?.transform?.read?.[field] !== 'undefined'
                        ? this.config.models[model.name].transform?.read?.[field](field)
                        : field

                if (selectRelation) {
                    selectStatements.push(`      "${field}", ${transformedField}`)
                } else {
                    selectStatements.push(`    "${field}", ${transformedField}`)
                }
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

    private queryBuilder(model: PrismaEdgeQLModelWithName) {
        let statement: string[] = []
        let vars: any[] = []
        let joins: any[] = []

        const _this = this

        function exec() {
            const sql = [statement.join('\n')]

            if (joins.length > 0) {
                sql.push(joins.join('\n'))
            }

            return { sql: `${sql.join('\n')};`, vars }
        }

        function where(prismaWhere: PrismaWhere) {
            if (prismaWhere) {
                const where = _this.sqlWhere(
                    model.table, prismaWhere || {}, { model, statements: ['WHERE'] },
                )
                statement = [
                    ...statement,
                    ...where.statements,
                ]
                vars = [
                    ...vars,
                    ...where.vars,
                ]
                joins = [
                    ...joins,
                    ...where.joins,
                ]
            }

            return {
                exec,
            }
        }

        function from(table: string) {
            statement = [...statement, `FROM\n  ${table}`]

            return {
                where,
                exec,
            }
        }

        function select(prismaSelect: PrismaSelect, type: 'one' | 'many') {
            if (prismaSelect) {
                const select = _this.sqlSelect(
                    model.table, prismaSelect || {}, { statements: [], type, model },
                )
                statement = [
                    ...statement,
                    ...select.statements,
                ]
            }

            return {
                from,
                exec,
            }
        }

        function set(prismaData: PrismaData) {
            if (prismaData) {
                const sqlSet: string[] = []
                for (const field in prismaData) {
                    const transformedField
                        = typeof _this.config?.models?.[model.name]?.transform?.write?.[field] !== 'undefined'
                            ? _this.config.models[model.name].transform?.write?.[field]('?')
                            : '?'
                    sqlSet.push(`  ${field} = ${transformedField}`)
                    vars.push(prismaData[field])
                }
                statement = [...statement, `SET\n${sqlSet.join(',\n')}`]
            }

            return {
                where,
            }
        }

        function update(table: string) {
            statement = [...statement, `UPDATE\n  ${table}`]

            return {
                set,
            }
        }

        return {
            update,
            select,
        }
    }

    public findOne(queryParams: FindManyQuery, model: PrismaEdgeQLModelWithName) {
        const ops: PrismaEdgeSQLOps = [
            this.queryBuilder(model)
                .select(queryParams.select, 'one')
                .from(model.table)
                .where(queryParams.where || null)
                .exec(),
        ]

        this.config?.logger?.('Prepare update SQL statement(s)', 'info')

        ops.forEach(({ sql, vars }) => {
            this.config?.logger?.(sql, 'debug')
            if (vars.length > 0)
                this.config?.logger?.(vars, 'debug')
        })

        return ops
    }

    public findMany(queryParams: FindManyQuery, model: PrismaEdgeQLModelWithName) {
        const ops: PrismaEdgeSQLOps = [
            this.queryBuilder(model)
                .select(queryParams.select, 'many')
                .from(model.table)
                .where(queryParams.where || null)
                .exec(),
        ]

        this.config?.logger?.('Prepare update SQL statement(s)', 'info')

        ops.forEach(({ sql, vars }) => {
            this.config?.logger?.(sql, 'debug')
            if (vars.length > 0)
                this.config?.logger?.(vars, 'debug')
        })

        return ops
    }

    public update(queryParams: UpdateQuery, model: PrismaEdgeQLModelWithName) {
        const ops: PrismaEdgeSQLOps = [
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

        this.config?.logger?.('Prepare update SQL statement(s)', 'info')

        ops.forEach(({ sql, vars }) => {
            this.config?.logger?.(sql, 'debug')
            if (vars.length > 0)
                this.config?.logger?.(vars, 'debug')
        })

        return ops
    }
}
