import type { AdapterParams } from './index';
export default class Prisma {
    private config;
    constructor(config: AdapterParams);
    client(): Client<string>;
    private executeQuery;
}
export type Client<Model extends string> = Record<Lowercase<Model>, {
    findUnique: <Payload = any | null, Args = FindUniqueQuery>(args: FindUniqueQuery | Omit<Args, 'include' | 'cursor' | 'distinct'>) => Promise<Payload>;
    findMany: <Payload = any, Args = FindManyQuery>(args?: FindManyQuery | Omit<Args, 'include' | 'cursor' | 'distinct'>) => Promise<Payload[]>;
    count: <Payload = number, Args = CountQuery>(args?: CountQuery | Omit<Args, 'include' | 'cursor' | 'distinct'>) => Promise<Payload>;
    create: <Payload = any | null, Args = CreateQuery>(args: CreateQuery | Omit<Args, 'include' | 'cursor' | 'distinct'>) => Promise<Payload>;
    update: <Payload = any | null, Args = UpdateQuery>(args: UpdateQuery | Omit<Args, 'include' | 'cursor' | 'distinct'>) => Promise<Payload>;
    upsert: <Payload = any | null, Args = UpsertQuery>(args: UpsertQuery | Omit<Args, 'include' | 'cursor' | 'distinct'>) => Promise<Payload>;
    delete: <Payload = any | null, Args = DeleteQuery>(args: DeleteQuery | Omit<Args, 'include' | 'cursor' | 'distinct'>) => Promise<Payload>;
}>;
export type PrismaCreate = object | null;
export type PrismaUpdate = object | null;
export type PrismaWhere = object | null;
export type PrismaSelect = object | null;
export type PrismaData = object | null;
export type FindUniqueQuery = {
    where: PrismaWhere;
    select?: PrismaSelect;
    skip?: number;
    take?: number;
};
export type FindManyQuery = {
    where?: PrismaWhere;
    select?: PrismaSelect;
    skip?: number;
    take?: number;
} | undefined;
export type CountQuery = {
    where?: PrismaWhere;
    select?: PrismaSelect;
    skip?: number;
    take?: number;
} | undefined;
export type CreateQuery = {
    data: PrismaData;
    select?: PrismaSelect;
};
export type UpdateQuery = {
    data: PrismaData;
    where: PrismaWhere;
    select?: PrismaSelect;
};
export type UpsertQuery = {
    where: PrismaWhere;
    update: PrismaUpdate;
    create: PrismaCreate;
    select?: PrismaSelect;
};
export type DeleteQuery = {
    where: PrismaWhere;
    select?: PrismaSelect;
};
