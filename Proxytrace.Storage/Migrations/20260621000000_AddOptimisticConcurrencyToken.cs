using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Proxytrace.Storage.Migrations
{
    /// <inheritdoc />
    public partial class AddOptimisticConcurrencyToken : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Marking UpdatedAt as an EF concurrency token changes only the SQL EF generates for
            // UPDATE/DELETE (it adds `WHERE UpdatedAt = @original` and checks the affected row
            // count); it does not alter the PostgreSQL schema, so there is no DDL to apply. The
            // model snapshot records the token annotation for future migration diffs.
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
        }
    }
}
