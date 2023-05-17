import GraphQL from './gql';
import PlanetScale from './drivers/pscale';
import { Client } from './prisma';
import type { FindManyQuery, FindUniqueQuery, UpdateQuery, DeleteQuery } from './prisma';
export { PlanetScale };
export default class PrismaEdgeQL<T extends PrismaEdgeQLParams> {
    gql: (query: string, args?: any) => GraphQL;
    driver: Driver;
    prisma: Client<keyof T['prismaModels'] extends string ? keyof T['prismaModels'] : string>;
    constructor(params: T);
}
export declare function makeModels(prismaModels: PrismaEdgeQLParams['prismaModels']): Models;
export type Driver = InstanceType<PrismaEdgeQLParams['driver']>;
export type ExecParams = {
    if?: ({ storage }: {
        storage: any;
    }) => any;
    before?: ({ storage, setVar }: {
        storage: any;
        setVar: any;
    }) => any;
    after?: ({ storage, result }: {
        storage: any;
        result: any;
    }) => any;
    silentErrors?: ({ storage }: {
        storage: any;
    }) => boolean;
};
export type Operations = {
    sql: string;
    vars: any[];
    __execParams?: ExecParams;
}[];
export type ModelRelationParams = {
    type: 'one' | 'many';
    from: string[];
    to: string[];
};
export type ModelFieldParams = {
    default?: string;
    type?: string;
    id?: boolean;
};
export type PrismaModels = {
    [name: string]: {
        fields?: {
            [field: string]: ModelFieldParams;
        };
        relations?: {
            [field: string]: ModelRelationParams;
        };
    };
};
export type Model = {
    name: string;
    table: string;
    primaryKey: string;
    columns: {
        [column: string]: {
            type: 'Binary(16)' | 'DateTime(3)';
            sqlIn: (data: any) => any;
            sqlOut: (data: any) => any;
        };
    };
    relations: {
        [field: string]: ModelRelationParams;
    };
    selectAll: string;
};
export type Models = {
    [key: string]: Model;
};
export type PrismaEdgeQLParams = {
    driver: typeof PlanetScale;
    databaseUrl: string;
    prismaModels?: PrismaModels;
    logger?: (msg: any, logLevel: 'debug' | 'info' | 'error') => void;
};
export type DriverParams = {
    databaseUrl: string;
    models: Models;
    logger: PrismaEdgeQLParams['logger'];
};
export type AdapterParams = {
    driver: Driver;
    models: Models;
    logger: PrismaEdgeQLParams['logger'];
};
export type PrismaEdgeDriverClass<DriverExecuteRes> = {
    execute: (sql: string, vars: any[]) => Promise<DriverExecuteRes>;
    formatOutput: <T>(data: DriverExecuteRes, opts?: {
        type?: 'one' | 'many';
    }) => T;
    findUnique: (queryParams: FindUniqueQuery, model: Model) => Operations;
    findMany: (queryParams: FindManyQuery, model: Model) => Operations;
    update: (queryParams: UpdateQuery, model: Model) => Operations;
    delete: (queryParams: DeleteQuery, model: Model) => Operations;
};
