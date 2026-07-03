using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Proxytrace.Storage.Migrations
{
    /// <inheritdoc />
    public partial class AddCustomAnomalyDetectors : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CustomAnomalyDetectorEntity",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Agent = table.Column<Guid>(type: "uuid", nullable: false),
                    Project = table.Column<Guid>(type: "uuid", nullable: false),
                    Triggers = table.Column<string>(type: "text", nullable: false),
                    AllAgents = table.Column<bool>(type: "boolean", nullable: false),
                    IsEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CustomAnomalyDetectorEntity", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CustomAnomalyDetectorEntity_AgentEntity_Agent",
                        column: x => x.Agent,
                        principalTable: "AgentEntity",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CustomAnomalyDetectorAgentEntity",
                columns: table => new
                {
                    DetectorId = table.Column<Guid>(type: "uuid", nullable: false),
                    AgentId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CustomAnomalyDetectorAgentEntity", x => new { x.DetectorId, x.AgentId });
                    table.ForeignKey(
                        name: "FK_CustomAnomalyDetectorAgentEntity_AgentEntity_AgentId",
                        column: x => x.AgentId,
                        principalTable: "AgentEntity",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CustomAnomalyDetectorAgentEntity_CustomAnomalyDetectorEntit~",
                        column: x => x.DetectorId,
                        principalTable: "CustomAnomalyDetectorEntity",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CustomAnomalyResultEntity",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    DetectorId = table.Column<Guid>(type: "uuid", nullable: false),
                    AgentCallId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProjectId = table.Column<Guid>(type: "uuid", nullable: false),
                    MatchedTrigger = table.Column<string>(type: "text", nullable: false),
                    Reasoning = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CustomAnomalyResultEntity", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CustomAnomalyResultEntity_AgentCallEntity_AgentCallId",
                        column: x => x.AgentCallId,
                        principalTable: "AgentCallEntity",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CustomAnomalyResultEntity_CustomAnomalyDetectorEntity_Detec~",
                        column: x => x.DetectorId,
                        principalTable: "CustomAnomalyDetectorEntity",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CustomAnomalyDetectorAgentEntity_AgentId",
                table: "CustomAnomalyDetectorAgentEntity",
                column: "AgentId");

            migrationBuilder.CreateIndex(
                name: "IX_CustomAnomalyDetectorEntity_Agent",
                table: "CustomAnomalyDetectorEntity",
                column: "Agent");

            migrationBuilder.CreateIndex(
                name: "IX_CustomAnomalyDetectorEntity_Project_IsEnabled",
                table: "CustomAnomalyDetectorEntity",
                columns: new[] { "Project", "IsEnabled" });

            migrationBuilder.CreateIndex(
                name: "IX_CustomAnomalyResultEntity_AgentCallId",
                table: "CustomAnomalyResultEntity",
                column: "AgentCallId");

            migrationBuilder.CreateIndex(
                name: "IX_CustomAnomalyResultEntity_DetectorId",
                table: "CustomAnomalyResultEntity",
                column: "DetectorId");

            migrationBuilder.CreateIndex(
                name: "IX_CustomAnomalyResultEntity_ProjectId_CreatedAt",
                table: "CustomAnomalyResultEntity",
                columns: new[] { "ProjectId", "CreatedAt" },
                descending: new[] { false, true });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CustomAnomalyDetectorAgentEntity");

            migrationBuilder.DropTable(
                name: "CustomAnomalyResultEntity");

            migrationBuilder.DropTable(
                name: "CustomAnomalyDetectorEntity");
        }
    }
}
