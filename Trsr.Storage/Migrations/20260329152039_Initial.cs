using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Trsr.Storage.Migrations
{
    /// <inheritdoc />
    public partial class Initial : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AgentCallEntity",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Model = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    Provider = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    Request = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Response = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    InputTokens = table.Column<int>(type: "int", nullable: false),
                    OutputTokens = table.Column<int>(type: "int", nullable: false),
                    DurationMs = table.Column<long>(type: "bigint", nullable: false),
                    HttpStatus = table.Column<int>(type: "int", nullable: false),
                    FinishReason = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    ErrorMessage = table.Column<string>(type: "nvarchar(2048)", maxLength: 2048, nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AgentCallEntity", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "OrganizationEntity",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OrganizationEntity", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "UserEntity",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserEntity", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ProjectEntity",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    Organization = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProjectEntity", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProjectEntity_OrganizationEntity_Organization",
                        column: x => x.Organization,
                        principalTable: "OrganizationEntity",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "OrganizationUserEntity",
                columns: table => new
                {
                    OrganizationId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OrganizationUserEntity", x => new { x.OrganizationId, x.UserId });
                    table.ForeignKey(
                        name: "FK_OrganizationUserEntity_OrganizationEntity_OrganizationId",
                        column: x => x.OrganizationId,
                        principalTable: "OrganizationEntity",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_OrganizationUserEntity_UserEntity_UserId",
                        column: x => x.UserId,
                        principalTable: "UserEntity",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "AgentEntity",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Project = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SystemMessage = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Tools = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AgentEntity", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AgentEntity_ProjectEntity_Project",
                        column: x => x.Project,
                        principalTable: "ProjectEntity",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AgentCallEntity_CreatedAt",
                table: "AgentCallEntity",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_AgentCallEntity_Model",
                table: "AgentCallEntity",
                column: "Model");

            migrationBuilder.CreateIndex(
                name: "IX_AgentCallEntity_Provider",
                table: "AgentCallEntity",
                column: "Provider");

            migrationBuilder.CreateIndex(
                name: "IX_AgentEntity_Project",
                table: "AgentEntity",
                column: "Project");

            migrationBuilder.CreateIndex(
                name: "IX_OrganizationEntity_Name",
                table: "OrganizationEntity",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_OrganizationUserEntity_UserId",
                table: "OrganizationUserEntity",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_ProjectEntity_Name_Organization",
                table: "ProjectEntity",
                columns: new[] { "Name", "Organization" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ProjectEntity_Organization",
                table: "ProjectEntity",
                column: "Organization");

            migrationBuilder.CreateIndex(
                name: "IX_UserEntity_Name",
                table: "UserEntity",
                column: "Name",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AgentCallEntity");

            migrationBuilder.DropTable(
                name: "AgentEntity");

            migrationBuilder.DropTable(
                name: "OrganizationUserEntity");

            migrationBuilder.DropTable(
                name: "ProjectEntity");

            migrationBuilder.DropTable(
                name: "UserEntity");

            migrationBuilder.DropTable(
                name: "OrganizationEntity");
        }
    }
}
