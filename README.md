# 🚧 Under active developement

A first preview version will be published in the coming weeks (no set date).

Please star the repo if you are interested!

---

# PrismaEdgeQL

Drop-in replacement to use Prisma Client on Edge environments with GraphQL queries and PlanetScale serverless driver.

## Why?

Prisma offers the best DX for creating data models, managing migrations and querying databases. Unfortunately, a huge limitation is [Prisma Client lack of support for Edge environments](https://github.com/prisma/prisma/issues/15265) such as Cloudflare Workers.

PrismaEdgeQL offers a ([very limited](#limitations)) drop-in replacement solution to use Prisma Client on Edge environments. In addition, it also converts GraphQL queries to Prisma-compatible query objects, so you don't have to manually transform incoming queries.

## What's the catch?

Lots of limitations! PrismaEdgeQL is designed for our own use case at [kuizto.co](https://kuizto.co) and is intended to be a **temporary solution** until Prisma officially releases support for Edge environments. As such, PrismaEdgeQL is extremely limited and only supports a basic subset of Prisma Client API.

## Usage

Given the below incoming GraphQL query:

```graphql
query {
  posts {
    title
  }
}
```

We can use **PrismaEdgeQL** inside our GraphQL resolver function:

```ts
import PrismaEdgeQL, { PlanetScaleDriver } from 'prisma-edgeql'

const config = {
  driver: PlanetScaleDriver,
  databaseUrl: env.DATABASE_URL,
  models: {
    post: { table: 'Post' }
  }
}

async function listPosts({ query, args }) {
  const { prisma, gql } = new PrismaEdgeQL<typeof config>(config)
  const { select, where } = gql(query, args)

  return await prisma.post.findMany({ select, where })
}
```

Under-the-hood **PrismaEdgeQL** will generate the following SQL and execute it using the PlanetScale serverless driver (compatible with Edge environments like CloudflareWorkers).

```sql
SELECT
  JSON_ARRAYAGG(JSON_OBJECT(
    "title", post.title
  ))
FROM Post;
```

## Limitations

### Overview

<table>
  <tr>
    <th style="text-align:left;" width="20%">Prisma Client API</th>
    <th style="text-align:left;" width="26%">Supported ✅</th>
    <th style="text-align:left;" width="26%">Coming soon 🚧</th>
    <th style="text-align:left;" width="26%">Not supported ❌</th>
  </tr>
  <tr>
    <td>Model queries</td>
    <td>
        <code>findOne</code>, <code>findMany</code>, <code>update</code>
    </td>
    <td>
        <code>create</code>, <code>upsert</code>, <code>delete</code>, <code>count</code>
    </td>
    <td>
        <code>findUnique</code>, <code>findUniqueOrThrow</code>, <code>findFirst</code>, <code>findFirstOrThrow</code>, <code>createMany</code>, <code>updateMany</code>, <code>deleteMany</code>, <code>aggregate</code>, <code>groupBy</code>
    </td>
  </tr>
  <tr>
    <td>Model query options</td>
    <td>
        <code>where</code>, <code>data</code>, <code>select</code>,
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
        x
    </td>
    <td>
        x
    </td>
    <td>
        <code>equals</code>, <code>not</code>, <code>in</code>, <code>notIn</code>, <code>lt</code>, <code>lte</code>, <code>gt</code>, <code>gte</code>, <code>contains</code>, <code>search</code>, <code>mode</code>, <code>startsWith</code>, <code>endsWith</code>, <code>AND</code>, <code>OR</code>, <code>NOT</code>
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

### Need more?

Feel free to open a PR and contribute to the repository! As an alternative, you can also **write your own SQL** queries using the PlanetScale serverless driver:

```ts
async function complexQuery({ query, args }) {
  const { driver: pscale } = new PrismaEdgeQL(config)
  const sql = `UPDATE Post SET title = ? WHERE id = ?;`
  const result = await pscale.execute(sql, ['hello world', 2])
}
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

#### `findOne`

Incoming GraphQL query

```graphql
mutation {
  post (where: { uuid: $uuid }) {
    uuid
    title
  }
}
```

Usage with PrismaEdgeQL

```ts
await prisma.post.findOne({ where, select })
```

Generated SQL

```sql
SELECT
  JSON_OBJECT(
    "uuid", uuid,
    "title", title
  )
FROM Post
WHERE uuid = ?;
```

#### `findMany`

Incoming GraphQL query

```graphql
mutation {
  posts {
    uuid
    title
  }
}
```

Usage with PrismaEdgeQL

```ts
await prisma.post.findMany({ select })
```

Generated SQL

```sql
SELECT
  JSON_ARRAYAGG(JSON_OBJECT(
    "uuid", uuid,
    "title", title
  ))
FROM Post;
```

#### `update`

Incoming GraphQL query

```graphql
mutation {
  updatePost (
    where: { uuid: $uuid }
    data: { title: $title }
  ) {
    title
  }
}
```

Usage with PrismaEdgeQL

```ts
await prisma.post.update({ where, data, select })
```

Generated SQL

```sql
UPDATE Post SET title = ? WHERE uuid = ?;

SELECT JSON_OBJECT("title", post.title) FROM Post;
```
