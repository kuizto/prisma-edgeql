interface variablesObject {
    [variableName: string]: any;
}
export declare const isArray: (arg: any) => arg is any[];
export declare function flatMap(arg: any, callback: any): any;
export declare function isString(arg: any): boolean;
export declare function isObject(arg: any): boolean;
export default function useParseGraphQLToJson(query: string, options?: {
    variables: variablesObject;
    operationName?: string;
}): any;
export {};
