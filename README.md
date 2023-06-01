# 🚧 Under active developement

A first preview version will be published soon.

Please star the repo if you are interested!

---

# Prisma-EdgeQL

**Edge-compatible Prisma Client (with PlanetScale driver).**

- ✅ Prisma-like Client syntax (designed as a limited subset of Prisma Client API)
- ✅ Works on Edge environments such as Cloudflare Workers
- ✅ PlanetScale serverless driver for JavaScript (MySQL-compatible)
- ✅ Automatically convert GraphQL queries to Prisma-compatible query objects
- ✅ Support writing and executing custom SQL queries

## Why?

[Prisma Client doesn't currently support Edge runtimes](https://github.com/prisma/prisma/issues/15265) such as Cloudflare Workers, making it impossible to use Prisma in modern applications. Prisma-EdgeQL offers a temporary drop-in replacement solution to use Prisma Client inside Edge environments.

**What's the catch?** Lots of limitations! Prisma-EdgeQL is designed for our own use case at [kuizto.co](https://kuizto.co) and is intended to be a **temporary solution** until Prisma officially releases support for Edge environments. As such, Prisma-EdgeQL only supports a [limited subset](#limitations) of the Prisma Client API.

**Using GraphQL?** The library comes with a built-in GraphQL adapter to convert incoming GraphQL queries into Prisma-compatible query objects, so you don't have to manually transform incoming queries.

### Work in progress

- [ ] Add `orderBy` option.
- [ ] Support `select` inside `create` or `upsert` queries with `@default(autoincrement())`.
- [ ] Bundle and release the first beta.

## Configuration

```typescript
import PrismaEdgeQL, { PlanetScaleDriver } from 'prisma-edgeql'

const config = {
  driver: PlanetScaleDriver,
  databaseUrl: env.DATABASE_URL,

  // manually declare models to use
  prismaModels: {
    Post: {
      // only @id field is required
      fields: {
        uuid: {
          default: 'dbgenerated("(uuid_to_bin(uuid(),1))")',
          id: true,
        }
      },
      // refers to @relation
      relations: {
        author: {
          from: ['Post', 'authorUuid'],
          to: ['User', 'uuid'],
          type: 'one' as const,
        }
      }
    }
  }
}
```

### Usage (as Prisma Client)

```ts
const { prisma } = new PrismaEdgeQL(config)

// find many posts using Prisma Client syntax
const posts = await prisma.post.findMany({
  where: { 
    title: { contains: 'world' }
  },
  select: { 
    uuid: true, 
    title: true, 
    author: { select: { email: true } }
  }
})
```

Under-the-hood **Prisma-EdgeQL** will generate the following SQL and execute it using the PlanetScale serverless driver (compatible with Edge environments like Cloudflare Workers).

```sql
SELECT
  JSON_ARRAYAGG(JSON_OBJECT(
    "uuid", uuid,
    "title", title,
    "author", (SELECT JSON_OBJECT(
      "email", email
    ) FROM User WHERE User.uuid = Post.authorUuid )
  ))
FROM Post WHERE title LIKE "%world%";
```

### Usage (with GraphQL queries)

```ts
const { prisma, gql } = new PrismaEdgeQL<typeof config>(config)

// convert GraphQL query to Prisma-compatible query objects
const { where, select } = gql(
  `query ($uuid: String!) {
      post (where: { uuid: $uuid }) {
        title
      }
  }`,
  { uuid: '123' }
)

// find one post using Prisma Client syntax
const post = await prisma.post.findUnique({ where, select })
```

## Limitations

### Overview

<sub id="note-1-info"><a href="#note-1-link">[1]</a> Using the `select` option inside `create` or `upsert` queries only works when model `@id` is set to `@default(dbgenerated("(uuid_to_bin(uuid(),1))"))`. Support for `@default(autoincrement())`, `@default(cuid())` and `@default(uuid())` will be added soon.</sub>

<table>
  <tr>
    <th style="text-align:left;" width="20%">Prisma Client API</th>
    <th style="text-align:left;" width="26%">Supported ✅</th>
    <th style="text-align:left;" width="26%">Coming soon 🚧</th>
    <th style="text-align:left;" width="26%">Not supported ❌</th>
  </tr>
  <tr id="note-1-link">
    <td>Model queries</td>
    <td>
        <code>findUnique</code>, <code>findMany</code>, <code>count</code>, <code>create<sup><a href="#note-1-info">[1]</a></sup></code>, <code>update</code>, <code>upsert<sup><a href="#note-1-info">[1]</a></sup></code>, <code>delete</code>
    </td>
    <td>
        <code>create<sup><a href="#note-1-info">[1]</a></sup></code>, <code>upsert<sup><a href="#note-1-info">[1]</a></sup></code>
    </td>
    <td>
        <code>findOne</code>, <code>findUniqueOrThrow</code>, <code>findFirst</code>, <code>findFirstOrThrow</code>, <code>createMany</code>, <code>updateMany</code>, <code>deleteMany</code>, <code>aggregate</code>, <code>groupBy</code>
    </td>
  </tr>
  <tr>
    <td>Model query options</td>
    <td>
        <code>where</code>, <code>data</code>, <code>select</code>, <code>skip</code>, <code>take</code>
    </td>
    <td>
        <code>orderBy</code>
    </td>
    <td>
        <code>include</code>, <code>distinct</code>
    </td>
  </tr>
  <tr>
    <td>Nested queries</td>
    <td>
        x
    </td>
    <td>
        x
    </td>
    <td>
        <code>create</code>, <code>createMany</code>, <code>set</code>, <code>connect</code>, <code>connectOrCreate</code>, <code>disconnect</code>, <code>update</code>, <code>upsert</code>, <code>delete</code>, <code>updateMany</code>, <code>deleteMany</code>
    </td>
  </tr>
  <tr>
    <td>Filter conditions and operators</td>
    <td>
        <code>equals</code>, <code>contains</code>, <code>lt</code>, <code>lte</code>, <code>gt</code>, <code>gte</code>, <code>in</code>, <code>notIn</code>
    </td>
    <td>
        x
    </td>
    <td>
        <code>not</code>,  <code>search</code>, <code>mode</code>, <code>startsWith</code>, <code>endsWith</code>, <code>AND</code>, <code>OR</code>, <code>NOT</code>
    </td>
  </tr>
  <tr>
    <td>Relation filters</td>
    <td>
        x
    </td>
    <td>
        x
    </td>
    <td>
        <code>some</code>, <code>every</code>, <code>none</code>, <code>is</code>, <code>isNot</code>
    </td>
  </tr>
  <tr>
    <td>Scalar list methods</td>
    <td>
        x
    </td>
    <td>
        x
    </td>
    <td>
        <code>set</code>, <code>push</code>, <code>unset</code>
    </td>
  </tr>
  <tr>
    <td>Scalar list filters</td>
    <td>
        x
    </td>
    <td>
        x
    </td>
    <td>
        <code>has</code>, <code>hasEvery</code>, <code>hasSome</code>, <code>isEmpty</code>, <code>isSet</code>, <code>equals</code>
    </td>
  </tr>
  <tr>
    <td>Composite type methods</td>
    <td>
        x
    </td>
    <td>
        x
    </td>
    <td>
        <code>set</code>, <code>unset</code>, <code>update</code>, <code>upsert</code>, <code>push</code>
    </td>
  </tr>
  <tr>
    <td>Composite type filters</td>
    <td>
        x
    </td>
    <td>
        x
    </td>
    <td>
        <code>equals</code>, <code>is</code>, <code>isNot</code>, <code>isEmpty</code>, <code>every</code>, <code>some</code>, <code>none</code>
    </td>
  </tr>
  <tr>
    <td>Atomic number operations</td>
    <td>
        x
    </td>
    <td>
        x
    </td>
    <td>
        <code>increment</code>, <code>decrement</code>, <code>multiply</code>, <code>divide</code>, <code>set</code>
    </td>
  </tr>
    <tr>
    <td>JSON filters</td>
    <td>
        x
    </td>
    <td>
        x
    </td>
    <td>
        <code>path</code>, <code>string_contains</code>, <code>string_starts_with</code>, <code>string_ends_with</code>, <code>array_contains</code>, <code>array_starts_with</code>, <code>array_ends_with</code>
    </td>
  </tr>
</table>

### How to improve Type safety?

```typescript
import type { Prisma } from '@prisma/client'

namespace PostFindMany {
    export type args = Prisma.PostFindManyArgs
    export type payload = Partial<Prisma.PostGetPayload<args>>
}

const { prisma } = new PrismaEdgeQL(config)

// improve type safety using PostFindMany
const posts = await prisma.post.findMany<PostFindMany.payload, PostFindMany.args>()
```

### Need more?

Feel free to open a PR and contribute to the repository!

As an alternative, you can also **write your own SQL** queries using the PlanetScale serverless driver:

```ts
const { driver: pscale } = new PrismaEdgeQL(config)

const query = `UPDATE Post SET title = ? WHERE id = ?;`
const params = ['hello world', 2]

await pscale.execute(query, params)
```

## Supported

### Model query options

#### `where`

```ts
// direct fields + related fields
{ 
  where: {
    title: FieldType
    author: { username: FieldType }
  }
}
```

#### `data`

```ts
// direct fields only
{ 
    data: { title: FieldType }
}
```

#### `select`

```ts
// direct fields + related fields
{ 
  select: {
    title: true
    author: { username: true }
  }
}
```

### Model queries

### `findUnique`

Usage with Prisma-EdgeQL

```ts
await prisma.post.findUnique({
  where: { uuid: '123' },
  select: { uuid: true, title: true }
})
```

Generated SQL

```sql
SELECT JSON_OBJECT("uuid", `uuid`, "title", `title`) 
FROM Post 
WHERE `uuid` = ?;
```

Injected vars

```json
["123"]
```

### `findMany`

Usage with Prisma-EdgeQL

```ts
await prisma.post.findMany({
  select: { uuid: true, title: true }
})
```

Generated SQL

```sql
SELECT JSON_ARRAYAGG(JSON_OBJECT("uuid", `uuid`, "title", `title`)) 
FROM Post;
```

### `count`

Usage with Prisma-EdgeQL

```ts
await prisma.post.count()
```

Generated SQL

```sql
SELECT COUNT(*) 
FROM Post;
```

### `create`

Usage with Prisma-EdgeQL

```ts
await prisma.post.create({
  data: { title: 'hello world' }
})
```

Generated SQL

```sql
SELECT JSON_OBJECT("uuid", LAST_INSERT_ID());

INSERT INTO Post(`title`) VALUES(?);

SELECT *, uuid as uuid 
FROM Post 
WHERE `uuid` = ?;
```

Injected vars

```json
["hello world",":uuid"]
```

### `update`

Usage with Prisma-EdgeQL

```ts
await prisma.post.update({
  where: { uuid: '123' },
  data: { title: 'hello world' },
  select: { title: true }
})
```

Generated SQL

```sql
UPDATE Post 
SET `title` = ? 
WHERE `uuid` = ?;

SELECT JSON_OBJECT("title", `title`) 
FROM Post 
WHERE `uuid` = ?;
```

Injected vars

```json
["hello world","123","123"]
```

### `upsert`

Usage with Prisma-EdgeQL

```ts
await prisma.post.upsert({
  where: { uuid: '123' },
  create: { title: 'hello world' },
  update: { title: 'hello world' },
  select: { title: true }
})
```

Generated SQL

```sql
UPDATE Post 
SET `title` = ? 
WHERE `uuid` = ?;

SELECT JSON_OBJECT("uuid", LAST_INSERT_ID());

INSERT INTO Post(`title`) VALUES(?);

SELECT JSON_OBJECT("title", `title`) 
FROM Post 
WHERE `uuid` = ?;
```

Injected vars

```json
["hello world","123","hello world",":uuid"]
```

### `delete`

Usage with Prisma-EdgeQL

```ts
await prisma.post.delete({
  where: { uuid: '123' }
})
```

Generated SQL

```sql
SELECT *, uuid as uuid 
FROM Post 
WHERE `uuid` = ?;

DELETE 
FROM Post 
WHERE `uuid` = ?;
```

Injected vars

```json
["123","123"]
```
