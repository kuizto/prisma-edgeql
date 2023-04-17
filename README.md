# 🚧 Under active developement

A first preview version will be published soon.

Please star the repo if you are interested!

---

# PrismaEdgeQL

**Edge-compatible Prisma Client (with PlanetScale driver).**

- ✅ Prisma-like Client syntax (designed as a limited subset of Prisma Client API)
- ✅ Works on Edge environments such as Cloudflare Workers
- ✅ PlanetScale serverless driver for JavaScript (MySQL-compatible)
- ✅ Automatically convert GraphQL queries to Prisma-compatible query objects
- ✅ Support writing and executing custom SQL queries

## Why?

[Prisma Client doesn't currently support Edge runtimes](https://github.com/prisma/prisma/issues/15265) such as Cloudflare Workers, making it impossible to use Prisma in modern applications. PrismaEdgeQL offers a temporary drop-in solution to use Prisma Client inside Edge environments.

**What's the catch?** Lots of limitations! PrismaEdgeQL is designed for our own use case at [kuizto.co](https://kuizto.co) and is intended to be a **temporary solution** until Prisma officially releases support for Edge environments. As such, PrismaEdgeQL only supports a [limited subset](#limitations) of the Prisma Client API.

**Using GraphQL?** The library comes with a built-in GraphQL adapter to convert incoming GraphQL queries into Prisma-compatible query objects, so you don't have to manually transform incoming queries.

## Configuration

```typescript
import PrismaEdgeQL, { PlanetScaleDriver } from 'prisma-edgeql'

const config = {
  driver: PlanetScaleDriver,
  databaseUrl: env.DATABASE_URL,

  // manually declare models you want to use
  models: {
    post: { 
        table: 'Post',
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
const { prisma } = new PrismaEdgeQL<typeof config>(config)

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

Under-the-hood **PrismaEdgeQL** will generate the following SQL and execute it using the PlanetScale serverless driver (compatible with Edge environments like Cloudflare Workers).

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
const post = await prisma.post.findOne({ where, select })
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
        <code>equals</code>, <code>contains</code>, <code>lt</code>, <code>lte</code>, <code>gt</code>, <code>gte</code>
    </td>
    <td>
        x
    </td>
    <td>
        <code>not</code>, <code>in</code>, <code>notIn</code>,  <code>search</code>, <code>mode</code>, <code>startsWith</code>, <code>endsWith</code>, <code>AND</code>, <code>OR</code>, <code>NOT</code>
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

#### `findOne`

Usage with PrismaEdgeQL

```ts
await prisma.post.findOne({
  where: { uuid: '123' },
  select: { uuid: true, title: true }
})
```

Generated SQL

```sql
SELECT
  JSON_OBJECT(
    "uuid", uuid,
    "title", title
  )
FROM Post
WHERE uuid = "123";
```

#### `findMany`

Usage with PrismaEdgeQL

```ts
await prisma.post.findMany({
  select: { uuid: true, title: true }
})
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
await prisma.post.update({
  where: { uuid: '123' },
  data: { title: 'hello world' },
  select: { title: true }
})
```

Generated SQL

```sql
UPDATE Post SET title = "hello world" WHERE uuid = "123";

SELECT JSON_OBJECT("title", title) FROM Post WHERE uuid = "123";
```
