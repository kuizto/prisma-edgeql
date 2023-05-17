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
SELECT JSON_OBJECT("uuid", uuid, "title", title) 
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
SELECT JSON_ARRAYAGG(JSON_OBJECT("uuid", uuid, "title", title)) 
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

SELECT JSON_OBJECT("title", title) 
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

SELECT JSON_OBJECT("title", title) 
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
