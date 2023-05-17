export default class GraphQL {
    select: any | null;
    where: any | null;
    data: any | null;
    constructor(query: string, args?: any);
}
export declare function parse(key: 'select' | 'data' | 'where', queryArgs?: any): any | null;
