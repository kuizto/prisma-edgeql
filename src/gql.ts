import { flatten } from 'wild-wild-utils'
import { set } from 'wild-wild-path'
import gqlToJson from './utils/gql-to-json'

export default class GraphQL {
    public select: any | null
    public where: any | null
    public data: any | null

    constructor(query: string, args?: any) {
        const queryObj = Object.values(
            Object.values((gqlToJson(query) as object))?.[0]
        )?.[0] || {}

        this.select = parse('select', queryObj)
        this.data = parse('data', args)
        this.where = parse('where', args)

        return this
    }
}

function parseSelect(queryObj?: any): any | null {
    const dotObj = flatten(queryObj || {}, { shallowArrays: true })
    const select = {}

    for (const path in dotObj) {
        if (!path.startsWith('__args'))
            set(
                select,
                path
                    .replace(/(edges)+\./g, '')
                    .replace(/(node)+\./g, '')
                    .replace(/\./g, '.select.'),
                true,
                { mutate: true }
            )
    }

    return Object.keys(select).length > 0 ? select : null
}

export function parse(key: 'select' | 'data' | 'where', queryArgs?: any): any | null {
    if (key === 'select')
        return parseSelect(queryArgs)
    else
        return queryArgs?.[key] && Object.keys(queryArgs[key]).length > 0 ? queryArgs[key] : null
}