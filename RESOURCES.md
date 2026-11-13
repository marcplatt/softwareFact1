# SQLite schema reading resources

## Knowledge

- [Drizzle schema declarations](https://orm.drizzle.team/docs/sql-schema-declaration)
  How table descriptions support typed queries and SQL generation.
- [Drizzle migration workflows](https://orm.drizzle.team/docs/migrations)
  Code-first and database-first approaches; use to explain why source declarations and actual database structure are separate.
- [Drizzle Kit generate](https://orm.drizzle.team/docs/drizzle-kit-generate) and [migrate](https://orm.drizzle.team/docs/drizzle-kit-migrate)
  Snapshot comparison, SQL generation, and applying changes to the database.

- [Drizzle SQLite column types](https://orm.drizzle.team/docs/sqlite/column-types)
  Column builders, aliases, and runtime defaults; use to distinguish ORM behavior from SQL constraints.
- [SQLite foreign keys](https://sqlite.org/foreignkeys.html)
  Relationship enforcement, connection settings, and deletion actions.
- [SQLite autoincrement](https://www.sqlite.org/autoinc.html)
  Automatic integer IDs versus the stronger non-reuse guarantee of AUTOINCREMENT.
- [SQLite query planning](https://sqlite.org/queryplanner.html)
  How composite indexes support queries; use when evaluating index order.

## Wisdom (Communities)

Not yet explored; the first lesson focuses on reading concrete code and official documentation.
