import type { ExecutedQuery } from '@planetscale/database';
import type { DeleteQuery, FindManyQuery, CountQuery, UpdateQuery, UpsertQuery, CreateQuery } from '../prisma';
import type { PrismaEdgeDriverClass, DriverParams, Model, Operations } from '../index';
export default class PlanetScale implements PrismaEdgeDriverClass<ExecutedQuery> {
    private config;
    private conn?;
    constructor(config: DriverParams);
    execute(sql: string, vars?: object | any[] | null, opts?: {
        silentErrors?: boolean;
    }): Promise<ExecutedQuery>;
    formatOutput<T>(data: ExecutedQuery, opts?: {
        type?: 'one' | 'many';
        model?: Model;
    }): T;
    private sqlWhere;
    private sqlSelect;
    private getModelConfigFromTable;
    private getRelationModelConfig;
    private queryBuilder;
    findUnique(queryParams: FindManyQuery, model: Model, log?: boolean): Operations;
    findMany(queryParams: FindManyQuery, model: Model, log?: boolean): Operations;
    count(queryParams: CountQuery, model: Model, log?: boolean): Operations;
    create(queryParams: CreateQuery, model: Model, log?: boolean): Operations;
    update(queryParams: UpdateQuery, model: Model, log?: boolean): Operations;
    upsert(queryParams: UpsertQuery, model: Model, log?: boolean): Operations;
    delete(queryParams: DeleteQuery, model: Model, log?: boolean): Operations;
    private log;
}
