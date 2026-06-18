using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Proxytrace.Storage.Migrations
{
    /// <inheritdoc />
    public partial class AddScheduleAnchor : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "AnchorAt",
                table: "TestRunScheduleEntity",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTimeOffset(new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)));

            // Existing schedules anchored their recurrence implicitly to CreatedAt (NextRunAt was
            // CreatedAt + k·interval). Backfill AnchorAt = CreatedAt so their fire phase is preserved
            // exactly; the epoch default above is only a transient placeholder for the NOT NULL add.
            migrationBuilder.Sql(@"UPDATE ""TestRunScheduleEntity"" SET ""AnchorAt"" = ""CreatedAt"";");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AnchorAt",
                table: "TestRunScheduleEntity");
        }
    }
}
