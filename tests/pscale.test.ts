import { expect, test } from "vitest";
import PrismaEdgeQL, { Operations, PlanetScale, type PrismaEdgeQLParams } from "../src/index";

const config = {
    driver: PlanetScale,
    databaseUrl: String(),
    models: {
        user: {
            table: 'User',
            primaryKey: { column: 'uuid', default: '(uuid_to_bin(uuid(),1))' },
            relations: {
                profileImage: {
                    from: ['User', 'uuid'],
                    to: ['Image', 'relatedToUserProfileUuid'],
                    type: 'one' as const,
                },
            },
            transform: {
                read: { uuid: (data: string) => `BIN_TO_UUID(${data})` },
                write: { uuid: (data: string) => `UUID_TO_BIN(${data})` }
            }
        },
        post: {
            table: 'Post',
            primaryKey: { column: 'uuid', default: '(uuid_to_bin(uuid(),1))' },
            relations: {
                images: {
                    from: ['Post', 'uuid'],
                    to: ['Image', 'relatedToPostUuid'],
                    type: 'many' as const,
                },
                author: {
                    from: ['Post', 'authorUuid'],
                    to: ['User', 'uuid'],
                    type: 'one' as const,
                }
            },
            transform: {
                read: { uuid: (data: string) => `BIN_TO_UUID(${data})` },
                write: { uuid: (data: string) => `UUID_TO_BIN(${data})` }
            }
        }
    },
    logger: () => { }
} satisfies PrismaEdgeQLParams

const emulateQueries = (ops: Operations, textExecParams?: { storage: any; results: any[] }) => {
    const storage = textExecParams?.storage || {}

    return ops
        ?.map((op, index) => {
            const setVar = (
                key: string,
                value: "string" | "number" | "bigint" | "boolean" | "undefined" | null
            ) => op.vars = op.vars.map(v => v === key ? value : v)

            if (op.__execParams?.before) op.__execParams.before({ storage, setVar })
            const result = textExecParams?.results?.[index]
            if (op.__execParams?.after) op.__execParams.after({ storage, result })

            return op
        })
        ?.filter(op => {
            const skip = typeof op?.__execParams?.if !== 'undefined' && op.__execParams.if({ storage }) === false
            return !skip
        })
        ?.map(({ sql, vars }) => ({
            sql: sql.replace(/(?:\s*\r?\n\s*|\s{2,})/g, ' ').replace(/\(\s/g, '(').replace(/\s\)/g, ')'),
            vars
        }))
}

const { driver: pscale } = new PrismaEdgeQL<typeof config>(config)
const Post = { ...config.models.post, name: 'post' }

// Model queries

test("findUnique", async () => {
    const queries = emulateQueries(pscale.findUnique({
        select: {
            uuid: true,
            title: true,
            author: { select: { email: true, profileImage: { select: { url: true } } } },
            images: { select: { url: true } }
        },
        where: {
            uuid: '123',
            title: { contains: 'foo' }
        }
    }, Post))

    expect(queries).toStrictEqual([
        {
            sql: `SELECT JSON_OBJECT("uuid", BIN_TO_UUID(uuid), "title", title, "author", (SELECT JSON_OBJECT("email", email, "profileImage", (SELECT JSON_OBJECT("url", url) FROM Image WHERE Image.relatedToUserProfileUuid = User.uuid)) FROM User WHERE User.uuid = Post.authorUuid), "images", (SELECT JSON_ARRAYAGG(JSON_OBJECT("url", url)) FROM Image WHERE Image.relatedToPostUuid = Post.uuid)) FROM Post WHERE uuid = UUID_TO_BIN(?) AND title LIKE ?;`,
            vars: ['123', '%foo%']
        },
    ]);
})

test("findMany", async () => {
    const queries = emulateQueries(pscale.findMany({
        select: {
            uuid: true,
            title: true,
            author: { select: { email: true } },
            images: { select: { url: true } }
        },
        where: {
            title: { contains: 'world' },
            author: { email: { equals: 'email@gmail.com' } },
        }
    }, Post))

    expect(queries).toStrictEqual([
        {
            sql: `SELECT JSON_ARRAYAGG(JSON_OBJECT("uuid", BIN_TO_UUID(uuid), "title", title, "author", (SELECT JSON_OBJECT("email", email) FROM User WHERE User.uuid = Post.authorUuid), "images", (SELECT JSON_ARRAYAGG(JSON_OBJECT("url", url)) FROM Image WHERE Image.relatedToPostUuid = Post.uuid))) FROM Post WHERE title LIKE ? AND User.email = ? LEFT JOIN User ON User.uuid = Post.authorUuid;`,
            vars: ['%world%', 'email@gmail.com']
        },
    ]);
});

test("create (last_insert_id = uuid_to_bin(uuid(),1))", async () => {
    const insertId = '20947'
    const execParamsOpts = { storage: {}, results: [{ uuid: insertId }, undefined, undefined, undefined] }

    const queries = emulateQueries(pscale.create({
        data: {
            title: 'hello world',
            author: { connect: { uuid: '234', email: 'email@email.fr' } },
        },
        select: {
            uuid: true,
            title: true,
            author: { select: { email: true } },
            images: { select: { url: true } }
        }
    }, Post), execParamsOpts)

    expect(queries).toStrictEqual([
        {
            sql: 'SELECT JSON_OBJECT("uuid", BIN_TO_UUID(uuid_to_bin(uuid(),1)));',
            vars: [],
        },
        {
            sql: 'SELECT JSON_OBJECT("uuid", BIN_TO_UUID(uuid), "email", email) FROM User WHERE uuid = UUID_TO_BIN(?);',
            vars: ['234'],
        },
        {
            sql: 'INSERT INTO Post(title, authorUuid) VALUES(?, ?);',
            vars: ['hello world', '234'],
        },
        {
            sql: 'SELECT JSON_OBJECT("uuid", BIN_TO_UUID(uuid), "title", title, "author", (SELECT JSON_OBJECT("email", email) FROM User WHERE User.uuid = Post.authorUuid), "images", (SELECT JSON_ARRAYAGG(JSON_OBJECT("url", url)) FROM Image WHERE Image.relatedToPostUuid = Post.uuid)) FROM Post WHERE uuid = UUID_TO_BIN(?);',
            vars: [insertId],
        }
    ]);
})

test("update", async () => {
    const queries = emulateQueries(pscale.update({
        where: {
            uuid: '123',
        },
        data: {
            title: 'hello world'
        },
        select: {
            uuid: true,
            title: true,
            author: { select: { email: true } },
            images: { select: { url: true } }
        }
    }, Post))

    expect(queries).toStrictEqual([
        {
            sql: 'UPDATE Post SET title = ? WHERE uuid = UUID_TO_BIN(?);',
            vars: ['hello world', '123']
        },
        {
            sql: 'SELECT JSON_OBJECT("uuid", BIN_TO_UUID(uuid), "title", title, "author", (SELECT JSON_OBJECT("email", email) FROM User WHERE User.uuid = Post.authorUuid), "images", (SELECT JSON_ARRAYAGG(JSON_OBJECT("url", url)) FROM Image WHERE Image.relatedToPostUuid = Post.uuid)) FROM Post WHERE uuid = UUID_TO_BIN(?);',
            vars: ['123']
        }
    ]);
})

test("upsert (update existing)", async () => {
    const textExecParams = {
        storage: {},
        results: [
            true, // update succeeded
            undefined,
        ]
    }

    const queries = emulateQueries(pscale.upsert({
        where: {
            uuid: '123',
        },
        update: {
            title: 'hello world'
        },
        create: {
            title: 'hello world'
        },
        select: {
            uuid: true,
            title: true,
            author: { select: { email: true } },
            images: { select: { url: true } }
        }
    }, Post), textExecParams)

    expect(queries).toStrictEqual([
        {
            sql: 'UPDATE Post SET title = ? WHERE uuid = UUID_TO_BIN(?);',
            vars: ['hello world', '123'],
        },
        {
            sql: 'SELECT JSON_OBJECT("uuid", BIN_TO_UUID(uuid), "title", title, "author", (SELECT JSON_OBJECT("email", email) FROM User WHERE User.uuid = Post.authorUuid), "images", (SELECT JSON_ARRAYAGG(JSON_OBJECT("url", url)) FROM Image WHERE Image.relatedToPostUuid = Post.uuid)) FROM Post WHERE uuid = UUID_TO_BIN(?);',
            vars: ['123'],
        }
    ]);
})

test("upsert (create new)", async () => {
    const insertId = '398473'
    const textExecParams = {
        storage: {},
        results: [
            null, // update failed
            { uuid: insertId }, // new insert uuid
            undefined,
            undefined,
        ]
    }

    const queries = emulateQueries(pscale.upsert({
        where: {
            uuid: '123',
        },
        update: {
            title: 'hello world'
        },
        create: {
            title: 'hello world'
        },
        select: {
            uuid: true,
            title: true,
            author: { select: { email: true } },
            images: { select: { url: true } }
        }
    }, Post), textExecParams)

    expect(queries).toStrictEqual([
        // update
        {
            sql: 'UPDATE Post SET title = ? WHERE uuid = UUID_TO_BIN(?);',
            vars: ['hello world', '123'],
        },
        // insert
        {
            sql: 'SELECT JSON_OBJECT("uuid", BIN_TO_UUID(uuid_to_bin(uuid(),1)));',
            vars: [],
        },
        {
            sql: 'INSERT INTO Post(title) VALUES(?);',
            vars: ['hello world'],
        },
        // select
        {
            sql: 'SELECT JSON_OBJECT("uuid", BIN_TO_UUID(uuid), "title", title, "author", (SELECT JSON_OBJECT("email", email) FROM User WHERE User.uuid = Post.authorUuid), "images", (SELECT JSON_ARRAYAGG(JSON_OBJECT("url", url)) FROM Image WHERE Image.relatedToPostUuid = Post.uuid)) FROM Post WHERE uuid = UUID_TO_BIN(?);',
            vars: [insertId],
        }
    ]);
})

test("delete", async () => {
    const queries = emulateQueries(pscale.delete({
        where: {
            uuid: '123',
        },
        select: {
            title: true
        }
    }, Post))

    expect(queries).toStrictEqual([
        {
            sql: 'SELECT JSON_OBJECT("title", title) FROM Post WHERE uuid = UUID_TO_BIN(?);',
            vars: ['123']
        },
        {
            sql: 'DELETE FROM Post WHERE uuid = UUID_TO_BIN(?);',
            vars: ['123']
        },
    ]);
})

// test("count", async () => {
//     const queries = emulateQueries(pscale.count({
//         where: {
//             uuid: '123',
//         }
//     }, Post))

//     expect(queries).toStrictEqual([
//         {
//             sql: 'SELECT JSON_OBJECT("title", title) FROM Post WHERE uuid = UUID_TO_BIN(?);',
//             vars: ['123']
//         },
//         {
//             sql: 'DELETE FROM Post WHERE uuid = UUID_TO_BIN(?);',
//             vars: ['123']
//         },
//     ]);
// })