# PostgreSQL Migration Notes

## Provider Change Instructions
1. In `backend/prisma/schema.prisma`, change the `provider` in the `datasource` block from `"sqlite"` to `"postgresql"`.
2. Update the `DATABASE_URL` environment variable in your `.env` file to point to your PostgreSQL connection string (e.g., `postgresql://user:password@localhost:5432/horizon_os`).

## JSON Fields
The following fields are currently stored as `String` (due to SQLite limitations) but contain JSON data. When migrating to PostgreSQL, these should be changed to the native `Json` type:
- `items` in the `Quotation` model
- `payload` in the `SyncLog` model

After changing these fields to Json type, run `npx prisma migrate dev` before `npx prisma generate` — do not skip the migration step or existing String data in these columns will cause a type mismatch error on first query.

## Raw Queries
- **$queryRaw / $executeRaw calls:** None found in the codebase. All existing database interactions use Prisma's standard ORM methods, which are inherently cross-compatible between SQLite and PostgreSQL.

## Enum Behavior
- **Note:** SQLite does not have native support for enums, so Prisma emulates them as strings. PostgreSQL has native enum support. Prisma handles this translation automatically, but you can explicitly define `enum` types in `schema.prisma` after switching to PostgreSQL for stricter database-level validation.

## Recommended Migration Sequence
To safely migrate the database schema, run the following commands in the `backend` directory:
1. `npx prisma migrate dev --name sqlite-to-postgres` (run this *after* making the provider change)
2. `npx prisma generate`
3. Verify the changes using `npx prisma studio`
