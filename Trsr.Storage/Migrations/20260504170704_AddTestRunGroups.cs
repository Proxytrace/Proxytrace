using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Trsr.Storage.Migrations
{
    /// <inheritdoc />
    public partial class AddTestRunGroups : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_TestRunEntity_TestSuiteEntity_Suite",
                table: "TestRunEntity");

            migrationBuilder.RenameColumn(
                name: "Suite",
                table: "TestRunEntity",
                newName: "Group");

            migrationBuilder.RenameIndex(
                name: "IX_TestRunEntity_Suite",
                table: "TestRunEntity",
                newName: "IX_TestRunEntity_Group");

            migrationBuilder.CreateTable(
                name: "TestRunGroupEntity",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Suite = table.Column<Guid>(type: "TEXT", nullable: false),
                    Status = table.Column<int>(type: "INTEGER", nullable: false),
                    CompletedAt = table.Column<DateTimeOffset>(type: "TEXT", nullable: true),
                    CreatedAt = table.Column<string>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<string>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TestRunGroupEntity", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TestRunGroupEntity_TestSuiteEntity_Suite",
                        column: x => x.Suite,
                        principalTable: "TestSuiteEntity",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            // Migrate existing runs: create one group per run (Id = Run.Id) and re-point the FK.
            // At this point TestRunEntity."Group" still holds the old Suite ID.
            migrationBuilder.Sql(@"
                INSERT INTO TestRunGroupEntity (Id, Suite, Status, CompletedAt, CreatedAt, UpdatedAt)
                SELECT Id, ""Group"", Status, CompletedAt, CreatedAt, UpdatedAt
                FROM TestRunEntity;
            ");

            migrationBuilder.Sql(@"
                UPDATE TestRunEntity SET ""Group"" = Id;
            ");

            migrationBuilder.CreateIndex(
                name: "IX_TestRunGroupEntity_Suite",
                table: "TestRunGroupEntity",
                column: "Suite");

            migrationBuilder.AddForeignKey(
                name: "FK_TestRunEntity_TestRunGroupEntity_Group",
                table: "TestRunEntity",
                column: "Group",
                principalTable: "TestRunGroupEntity",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_TestRunEntity_TestRunGroupEntity_Group",
                table: "TestRunEntity");

            migrationBuilder.DropTable(
                name: "TestRunGroupEntity");

            migrationBuilder.RenameColumn(
                name: "Group",
                table: "TestRunEntity",
                newName: "Suite");

            migrationBuilder.RenameIndex(
                name: "IX_TestRunEntity_Group",
                table: "TestRunEntity",
                newName: "IX_TestRunEntity_Suite");

            migrationBuilder.AddForeignKey(
                name: "FK_TestRunEntity_TestSuiteEntity_Suite",
                table: "TestRunEntity",
                column: "Suite",
                principalTable: "TestSuiteEntity",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
