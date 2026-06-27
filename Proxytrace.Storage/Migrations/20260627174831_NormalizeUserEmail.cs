using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Proxytrace.Storage.Migrations
{
    /// <inheritdoc />
    public partial class NormalizeUserEmail : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Backfill existing rows to the canonical form the write path now produces
            // (User constructor stores Email as Trim().ToLowerInvariant()), so the plain
            // case-sensitive unique B-tree index on "Email" is now effectively
            // case-insensitive and the exact-match login lookup is index-served (#255).
            // No schema/model change — this is data-only, so the model snapshot is unchanged.
            // Caveat: if two rows already differ only by case/whitespace this UPDATE trips the
            // unique index and the migration fails; such duplicate accounts must be merged first.
            migrationBuilder.Sql(
                @"UPDATE ""UserEntity"" SET ""Email"" = lower(btrim(""Email"")) WHERE ""Email"" <> lower(btrim(""Email""));");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Lowercasing is irreversible — the original casing is not recoverable.
        }
    }
}
