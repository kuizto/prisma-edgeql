import { expect, test } from "vitest";
import PlanetScale from "../src/drivers/pscale";
import PrismaEdgeQL, { type PrismaEdgeQLParams } from "../src/index";

const config = {
    driver: PlanetScale,
    databaseUrl: String(),
    models: {
        post: {
            table: 'Post',
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

const parseSQL = (ops: { sql: string; vars: any[] }[]) => {
    return ops?.map(op => ({
        sql: op.sql.replace(/(?:\s*\r?\n\s*|\s{2,})/g, ' '),
        vars: op.vars
    }))
}

const { driver: pscale } = new PrismaEdgeQL<typeof config>(config)
const Post = { ...config.models.post, name: 'post' }

// Model queries

test("findOne", async () => {
    const queries = parseSQL(pscale.findOne({
        select: {
            uuid: true,
            title: true,
            author: { select: { email: true } },
            images: { select: { url: true } }
        },
        where: {
            uuid: '123',
        }
    }, Post))

    expect(queries).toStrictEqual([
        {
            sql: `SELECT JSON_OBJECT( "uuid", BIN_TO_UUID(uuid), "title", title, "author", (SELECT JSON_OBJECT( "email", email ) FROM User WHERE User.uuid = Post.authorUuid ), "images", (SELECT JSON_ARRAYAGG(JSON_OBJECT( "url", url )) FROM Image WHERE Image.relatedToPostUuid = Post.uuid ) ) FROM Post WHERE uuid = UUID_TO_BIN(?);`,
            vars: ['123']
        },
    ]);
})

test("findMany", async () => {
    const queries = parseSQL(pscale.findMany({
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
            sql: `SELECT JSON_ARRAYAGG(JSON_OBJECT( "uuid", BIN_TO_UUID(uuid), "title", title, "author", (SELECT JSON_OBJECT( "email", email ) FROM User WHERE User.uuid = Post.authorUuid ), "images", (SELECT JSON_ARRAYAGG(JSON_OBJECT( "url", url )) FROM Image WHERE Image.relatedToPostUuid = Post.uuid ) )) FROM Post WHERE title LIKE '%"?"%' AND User.email = ? LEFT JOIN User ON User.uuid = Post.authorUuid;`,
            vars: ['world', 'email@gmail.com']
        },
    ]);
});

test("update", async () => {
    const queries = parseSQL(pscale.update({
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
            sql: 'SELECT JSON_OBJECT( "uuid", BIN_TO_UUID(uuid), "title", title, "author", (SELECT JSON_OBJECT( "email", email ) FROM User WHERE User.uuid = Post.authorUuid ), "images", (SELECT JSON_ARRAYAGG(JSON_OBJECT( "url", url )) FROM Image WHERE Image.relatedToPostUuid = Post.uuid ) ) FROM Post WHERE uuid = UUID_TO_BIN(?);',
            vars: ['123']
        }
    ]);
})