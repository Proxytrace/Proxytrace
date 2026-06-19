using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Proxytrace.Storage.Migrations
{
    /// <inheritdoc />
    public partial class AddNotifications : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "NotificationEntity",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Kind = table.Column<int>(type: "integer", nullable: false),
                    Severity = table.Column<int>(type: "integer", nullable: false),
                    Title = table.Column<string>(type: "text", nullable: false),
                    Message = table.Column<string>(type: "text", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    ProjectId = table.Column<Guid>(type: "uuid", nullable: true),
                    TargetKind = table.Column<int>(type: "integer", nullable: true),
                    TargetId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_NotificationEntity", x => x.Id);
                    table.ForeignKey(
                        name: "FK_NotificationEntity_ProjectEntity_ProjectId",
                        column: x => x.ProjectId,
                        principalTable: "ProjectEntity",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_NotificationEntity_CreatedAt",
                table: "NotificationEntity",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_NotificationEntity_ProjectId",
                table: "NotificationEntity",
                column: "ProjectId");

            migrationBuilder.CreateIndex(
                name: "IX_NotificationEntity_ProjectId_Status",
                table: "NotificationEntity",
                columns: new[] { "ProjectId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_NotificationEntity_Status",
                table: "NotificationEntity",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_NotificationEntity_TargetKind_TargetId",
                table: "NotificationEntity",
                columns: new[] { "TargetKind", "TargetId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "NotificationEntity");
        }
    }
}
