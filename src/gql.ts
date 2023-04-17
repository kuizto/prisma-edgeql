import { flatten } from 'wild-wild-utils'
import { set } from 'wild-wild-path'
import Json from './json'

export default class GraphQL {
    public select: any | null
    public where: any | null
    public data: any | null

    constructor(query: string, args?: any) {
        const queryObj = Object.values(
            Object.values((Json(query) as object))?.[0]
        )?.[0] || {}

        this.select = this.parseSelect(queryObj)
        this.data = this.parseData(args)
        this.where = this.parseWhere(args)

        return this
    }

    private parseSelect(queryObj?: any): any | null {
        const dotObj = flatten(queryObj || {}, { shallowArrays: true })
        const select = {}

        for (const path in dotObj) {
            if (!path.startsWith('__args'))
                set(select, path.replace(/(edges)+\./g, '').replace(/(node)+\./g, '').replace(/\./g, '.select.'), true, { mutate: true })
        }

        return Object.keys(select).length > 0
            ? select
            : null
    }

    private parseData(queryArgs?: any): any | null {
        return queryArgs?.data && Object.keys(queryArgs.data).length > 0
            ? queryArgs.data
            : null
    }

    private parseWhere(queryArgs?: any): any | null {
        return queryArgs?.where && Object.keys(queryArgs.where).length > 0
            ? queryArgs.where
            : null
    }
}