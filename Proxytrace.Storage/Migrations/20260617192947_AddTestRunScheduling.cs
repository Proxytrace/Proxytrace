using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Proxytrace.Storage.Migrations
{
    /// <inheritdoc />
    public partial class AddTestRunScheduling : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ScheduleId",
                table: "TestRunGroupEntity",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "TestRunScheduleEntity",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Suite = table.Column<Guid>(type: "uuid", nullable: false),
                    IntervalMinutes = table.Column<int>(type: "integer", nullable: false),
                    IsEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    NextRunAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    LastRunAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TestRunScheduleEntity", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TestRunScheduleEntity_TestSuiteEntity_Suite",
                        column: x => x.Suite,
                        principalTable: "TestSuiteEntity",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TestRunScheduleEndpointEntity",
                columns: table => new
                {
                    ScheduleId = table.Column<Guid>(type: "uuid", nullable: false),
                    EndpointId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TestRunScheduleEndpointEntity", x => new { x.ScheduleId, x.EndpointId });
                    table.ForeignKey(
                        name: "FK_TestRunScheduleEndpointEntity_ModelEndpointEntity_EndpointId",
                        column: x => x.EndpointId,
                        principalTable: "ModelEndpointEntity",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_TestRunScheduleEndpointEntity_TestRunScheduleEntity_Schedul~",
                        column: x => x.ScheduleId,
                        principalTable: "TestRunScheduleEntity",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TestRunGroupEntity_ScheduleId",
                table: "TestRunGroupEntity",
                column: "ScheduleId");

            migrationBuilder.CreateIndex(
                name: "IX_TestRunScheduleEndpointEntity_EndpointId",
                table: "TestRunScheduleEndpointEntity",
                column: "EndpointId");

            migrationBuilder.CreateIndex(
                name: "IX_TestRunScheduleEntity_IsEnabled_NextRunAt",
                table: "TestRunScheduleEntity",
                columns: new[] { "IsEnabled", "NextRunAt" });

            migrationBuilder.CreateIndex(
                name: "IX_TestRunScheduleEntity_Suite",
                table: "TestRunScheduleEntity",
                column: "Suite");

            migrationBuilder.AddForeignKey(
                name: "FK_TestRunGroupEntity_TestRunScheduleEntity_ScheduleId",
                table: "TestRunGroupEntity",
                column: "ScheduleId",
                principalTable: "TestRunScheduleEntity",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_TestRunGroupEntity_TestRunScheduleEntity_ScheduleId",
                table: "TestRunGroupEntity");

            migrationBuilder.DropTable(
                name: "TestRunScheduleEndpointEntity");

            migrationBuilder.DropTable(
                name: "TestRunScheduleEntity");

            migrationBuilder.DropIndex(
                name: "IX_TestRunGroupEntity_ScheduleId",
                table: "TestRunGroupEntity");

            migrationBuilder.DropColumn(
                name: "ScheduleId",
                table: "TestRunGroupEntity");
        }
    }
}
