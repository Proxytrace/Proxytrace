using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Proxytrace.Storage.Migrations
{
    /// <inheritdoc />
    public partial class AddAgentCallToolAgentId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Add as NOT NULL with a temporary empty default so it can land on existing tool rows
            // (the tool-name table shipped one release earlier without AgentId).
            migrationBuilder.AddColumn<Guid>(
                name: "AgentId",
                table: "AgentCallToolEntity",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            // Backfill AgentId from each row's call → agent version — exactly what ingestion
            // denormalises going forward. Every tool row has a call, and every call a version.
            migrationBuilder.Sql(
                """
                UPDATE "AgentCallToolEntity" AS t
                SET "AgentId" = v."AgentId"
                FROM "AgentCallEntity" AS c, "AgentVersionEntity" AS v
                WHERE t."AgentCallId" = c."Id" AND c."AgentVersionId" = v."Id";
                """);

            // Drop the placeholder default so the column matches the model (AgentId is always supplied
            // by ingestion/backfill; no server-side default).
            migrationBuilder.Sql(
                """ALTER TABLE "AgentCallToolEntity" ALTER COLUMN "AgentId" DROP DEFAULT;""");

            migrationBuilder.CreateIndex(
                name: "IX_AgentCallToolEntity_ProjectId_AgentId_ToolName",
                table: "AgentCallToolEntity",
                columns: new[] { "ProjectId", "AgentId", "ToolName" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_AgentCallToolEntity_ProjectId_AgentId_ToolName",
                table: "AgentCallToolEntity");

            migrationBuilder.DropColumn(
                name: "AgentId",
                table: "AgentCallToolEntity");
        }
    }
}
