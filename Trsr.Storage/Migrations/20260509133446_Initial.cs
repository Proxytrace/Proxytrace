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
                name: "EvaluatorEntity",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Kind = table.Column<int>(type: "INTEGER", nullable: false),
                    Project = table.Column<Guid>(type: "TEXT", nullable: false),
                    Data = table.Column<string>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<string>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<string>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EvaluatorEntity", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ModelEntity",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Name = table.Column<string>(type: "TEXT", maxLength: 256, nullable: false),
                    CreatedAt = table.Column<string>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<string>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ModelEntity", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ModelProviderEntity",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Name = table.Column<string>(type: "TEXT", maxLength: 256, nullable: false),
                    Endpoint = table.Column<string>(type: "TEXT", maxLength: 2048, nullable: false),
                    ApiKey = table.Column<string>(type: "TEXT", maxLength: 512, nullable: false),
                    Kind = table.Column<int>(type: "INTEGER", nullable: false),
                    CreatedAt = table.Column<string>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<string>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ModelProviderEntity", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "TestCaseEntity",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Input = table.Column<string>(type: "TEXT", nullable: false),
                    ExpectedOutput = table.Column<string>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<string>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<string>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TestCaseEntity", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "UserEntity",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Name = table.Column<string>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<string>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<string>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserEntity", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ModelEndpointEntity",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Model = table.Column<Guid>(type: "TEXT", nullable: false),
                    Provider = table.Column<Guid>(type: "TEXT", nullable: false),
                    InputTokenCost = table.Column<decimal>(type: "TEXT", precision: 18, scale: 6, nullable: true),
                    OutputTokenCost = table.Column<decimal>(type: "TEXT", precision: 18, scale: 6, nullable: true),
                    CreatedAt = table.Column<string>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<string>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ModelEndpointEntity", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ModelEndpointEntity_ModelEntity_Model",
                        column: x => x.Model,
                        principalTable: "ModelEntity",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ModelEndpointEntity_ModelProviderEntity_Provider",
                        column: x => x.Provider,
                        principalTable: "ModelProviderEntity",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TestResultEntity",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    TestCase = table.Column<Guid>(type: "TEXT", nullable: false),
                    ActualResponse = table.Column<string>(type: "TEXT", nullable: false),
                    Evaluations = table.Column<string>(type: "TEXT", nullable: false),
                    DurationMs = table.Column<long>(type: "INTEGER", nullable: false),
                    InputTokens = table.Column<long>(type: "INTEGER", nullable: true),
                    OutputTokens = table.Column<long>(type: "INTEGER", nullable: true),
                    CreatedAt = table.Column<string>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<string>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TestResultEntity", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TestResultEntity_TestCaseEntity_TestCase",
                        column: x => x.TestCase,
                        principalTable: "TestCaseEntity",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ProjectEntity",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Name = table.Column<string>(type: "TEXT", nullable: false),
                    SystemEndpoint = table.Column<Guid>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<string>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<string>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProjectEntity", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProjectEntity_ModelEndpointEntity_SystemEndpoint",
                        column: x => x.SystemEndpoint,
                        principalTable: "ModelEndpointEntity",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "AgentEntity",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Name = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false),
                    Project = table.Column<Guid>(type: "TEXT", nullable: false),
                    Endpoint = table.Column<Guid>(type: "TEXT", nullable: false),
                    Fingerprint = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    SystemPrompt = table.Column<string>(type: "TEXT", nullable: false),
                    IsSystemAgent = table.Column<bool>(type: "INTEGER", nullable: false),
                    Tools = table.Column<string>(type: "TEXT", nullable: false),
                    ModelParameters = table.Column<string>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<string>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<string>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AgentEntity", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AgentEntity_ModelEndpointEntity_Endpoint",
                        column: x => x.Endpoint,
                        principalTable: "ModelEndpointEntity",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_AgentEntity_ProjectEntity_Project",
                        column: x => x.Project,
                        principalTable: "ProjectEntity",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ApiKeyEntity",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Name = table.Column<string>(type: "TEXT", maxLength: 256, nullable: false),
                    ApiKey = table.Column<string>(type: "TEXT", maxLength: 512, nullable: false),
                    Project = table.Column<Guid>(type: "TEXT", nullable: false),
                    Provider = table.Column<Guid>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<string>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<string>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ApiKeyEntity", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ApiKeyEntity_ModelProviderEntity_Provider",
                        column: x => x.Provider,
                        principalTable: "ModelProviderEntity",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ApiKeyEntity_ProjectEntity_Project",
                        column: x => x.Project,
                        principalTable: "ProjectEntity",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ProjectUserEntity",
                columns: table => new
                {
                    ProjectId = table.Column<Guid>(type: "TEXT", nullable: false),
                    UserId = table.Column<Guid>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProjectUserEntity", x => new { x.ProjectId, x.UserId });
                    table.ForeignKey(
                        name: "FK_ProjectUserEntity_ProjectEntity_ProjectId",
                        column: x => x.ProjectId,
                        principalTable: "ProjectEntity",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ProjectUserEntity_UserEntity_UserId",
                        column: x => x.UserId,
                        principalTable: "UserEntity",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "AgentCallEntity",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    AgentId = table.Column<Guid>(type: "TEXT", nullable: false),
                    EndpointId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Request = table.Column<string>(type: "TEXT", nullable: false),
                    Response = table.Column<string>(type: "TEXT", nullable: true),
                    InputTokens = table.Column<ulong>(type: "INTEGER", nullable: true),
                    OutputTokens = table.Column<ulong>(type: "INTEGER", nullable: true),
                    LatencyMs = table.Column<double>(type: "REAL", nullable: true),
                    HttpStatus = table.Column<int>(type: "INTEGER", nullable: false),
                    FinishReason = table.Column<string>(type: "TEXT", maxLength: 64, nullable: true),
                    ErrorMessage = table.Column<string>(type: "TEXT", maxLength: 2048, nullable: true),
                    ModelParameters = table.Column<string>(type: "TEXT", nullable: false),
                    ConversationId = table.Column<Guid>(type: "TEXT", nullable: true),
                    CreatedAt = table.Column<string>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<string>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AgentCallEntity", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AgentCallEntity_AgentEntity_AgentId",
                        column: x => x.AgentId,
                        principalTable: "AgentEntity",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_AgentCallEntity_ModelEndpointEntity_EndpointId",
                        column: x => x.EndpointId,
                        principalTable: "ModelEndpointEntity",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "OptimizationProposalEntity",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Agent = table.Column<Guid>(type: "TEXT", nullable: false),
                    Kind = table.Column<int>(type: "INTEGER", nullable: false),
                    Status = table.Column<int>(type: "INTEGER", nullable: false),
                    Priority = table.Column<int>(type: "INTEGER", nullable: false),
                    Rationale = table.Column<string>(type: "TEXT", nullable: false),
                    Details = table.Column<string>(type: "TEXT", nullable: false),
                    EvidenceTestRunIds = table.Column<string>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<string>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<string>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OptimizationProposalEntity", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OptimizationProposalEntity_AgentEntity_Agent",
                        column: x => x.Agent,
                        principalTable: "AgentEntity",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TestSuiteEntity",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Name = table.Column<string>(type: "TEXT", nullable: false),
                    Agent = table.Column<Guid>(type: "TEXT", nullable: false),
                    TestCases = table.Column<string>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<string>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<string>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TestSuiteEntity", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TestSuiteEntity_AgentEntity_Agent",
                        column: x => x.Agent,
                        principalTable: "AgentEntity",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

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

            migrationBuilder.CreateTable(
                name: "TestSuiteEvaluatorEntity",
                columns: table => new
                {
                    TestSuiteId = table.Column<Guid>(type: "TEXT", nullable: false),
                    EvaluatorId = table.Column<Guid>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TestSuiteEvaluatorEntity", x => new { x.TestSuiteId, x.EvaluatorId });
                    table.ForeignKey(
                        name: "FK_TestSuiteEvaluatorEntity_EvaluatorEntity_EvaluatorId",
                        column: x => x.EvaluatorId,
                        principalTable: "EvaluatorEntity",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_TestSuiteEvaluatorEntity_TestSuiteEntity_TestSuiteId",
                        column: x => x.TestSuiteId,
                        principalTable: "TestSuiteEntity",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TestRunEntity",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Group = table.Column<Guid>(type: "TEXT", nullable: false),
                    Endpoint = table.Column<Guid>(type: "TEXT", nullable: false),
                    Status = table.Column<int>(type: "INTEGER", nullable: false),
                    CompletedAt = table.Column<DateTimeOffset>(type: "TEXT", nullable: true),
                    TestResults = table.Column<string>(type: "TEXT", nullable: false),
                    StatTestCases = table.Column<int>(type: "INTEGER", nullable: false),
                    StatPassed = table.Column<int>(type: "INTEGER", nullable: false),
                    StatInputTokens = table.Column<long>(type: "INTEGER", nullable: true),
                    StatOutputTokens = table.Column<long>(type: "INTEGER", nullable: true),
                    StatTotalDurationMs = table.Column<long>(type: "INTEGER", nullable: true),
                    StatCost = table.Column<decimal>(type: "TEXT", nullable: true),
                    CreatedAt = table.Column<string>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<string>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TestRunEntity", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TestRunEntity_ModelEndpointEntity_Endpoint",
                        column: x => x.Endpoint,
                        principalTable: "ModelEndpointEntity",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_TestRunEntity_TestRunGroupEntity_Group",
                        column: x => x.Group,
                        principalTable: "TestRunGroupEntity",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AgentCallEntity_AgentId",
                table: "AgentCallEntity",
                column: "AgentId");

            migrationBuilder.CreateIndex(
                name: "IX_AgentCallEntity_ConversationId",
                table: "AgentCallEntity",
                column: "ConversationId");

            migrationBuilder.CreateIndex(
                name: "IX_AgentCallEntity_CreatedAt",
                table: "AgentCallEntity",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_AgentCallEntity_EndpointId",
                table: "AgentCallEntity",
                column: "EndpointId");

            migrationBuilder.CreateIndex(
                name: "IX_AgentEntity_Endpoint",
                table: "AgentEntity",
                column: "Endpoint");

            migrationBuilder.CreateIndex(
                name: "IX_AgentEntity_Fingerprint",
                table: "AgentEntity",
                column: "Fingerprint",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_AgentEntity_IsSystemAgent",
                table: "AgentEntity",
                column: "IsSystemAgent");

            migrationBuilder.CreateIndex(
                name: "IX_AgentEntity_Project",
                table: "AgentEntity",
                column: "Project");

            migrationBuilder.CreateIndex(
                name: "IX_ApiKeyEntity_ApiKey",
                table: "ApiKeyEntity",
                column: "ApiKey",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ApiKeyEntity_Project",
                table: "ApiKeyEntity",
                column: "Project");

            migrationBuilder.CreateIndex(
                name: "IX_ApiKeyEntity_Provider",
                table: "ApiKeyEntity",
                column: "Provider");

            migrationBuilder.CreateIndex(
                name: "IX_EvaluatorEntity_Kind",
                table: "EvaluatorEntity",
                column: "Kind");

            migrationBuilder.CreateIndex(
                name: "IX_ModelEndpointEntity_Model_Provider",
                table: "ModelEndpointEntity",
                columns: new[] { "Model", "Provider" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ModelEndpointEntity_Provider",
                table: "ModelEndpointEntity",
                column: "Provider");

            migrationBuilder.CreateIndex(
                name: "IX_ModelEntity_Name",
                table: "ModelEntity",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ModelProviderEntity_Name",
                table: "ModelProviderEntity",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_OptimizationProposalEntity_Agent",
                table: "OptimizationProposalEntity",
                column: "Agent");

            migrationBuilder.CreateIndex(
                name: "IX_OptimizationProposalEntity_Kind",
                table: "OptimizationProposalEntity",
                column: "Kind");

            migrationBuilder.CreateIndex(
                name: "IX_OptimizationProposalEntity_Status",
                table: "OptimizationProposalEntity",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_ProjectEntity_Name",
                table: "ProjectEntity",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ProjectEntity_SystemEndpoint",
                table: "ProjectEntity",
                column: "SystemEndpoint");

            migrationBuilder.CreateIndex(
                name: "IX_ProjectUserEntity_UserId",
                table: "ProjectUserEntity",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_TestResultEntity_TestCase",
                table: "TestResultEntity",
                column: "TestCase");

            migrationBuilder.CreateIndex(
                name: "IX_TestRunEntity_Endpoint",
                table: "TestRunEntity",
                column: "Endpoint");

            migrationBuilder.CreateIndex(
                name: "IX_TestRunEntity_Group",
                table: "TestRunEntity",
                column: "Group");

            migrationBuilder.CreateIndex(
                name: "IX_TestRunGroupEntity_Suite",
                table: "TestRunGroupEntity",
                column: "Suite");

            migrationBuilder.CreateIndex(
                name: "IX_TestSuiteEntity_Agent",
                table: "TestSuiteEntity",
                column: "Agent");

            migrationBuilder.CreateIndex(
                name: "IX_TestSuiteEvaluatorEntity_EvaluatorId",
                table: "TestSuiteEvaluatorEntity",
                column: "EvaluatorId");

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
                name: "ApiKeyEntity");

            migrationBuilder.DropTable(
                name: "OptimizationProposalEntity");

            migrationBuilder.DropTable(
                name: "ProjectUserEntity");

            migrationBuilder.DropTable(
                name: "TestResultEntity");

            migrationBuilder.DropTable(
                name: "TestRunEntity");

            migrationBuilder.DropTable(
                name: "TestSuiteEvaluatorEntity");

            migrationBuilder.DropTable(
                name: "UserEntity");

            migrationBuilder.DropTable(
                name: "TestCaseEntity");

            migrationBuilder.DropTable(
                name: "TestRunGroupEntity");

            migrationBuilder.DropTable(
                name: "EvaluatorEntity");

            migrationBuilder.DropTable(
                name: "TestSuiteEntity");

            migrationBuilder.DropTable(
                name: "AgentEntity");

            migrationBuilder.DropTable(
                name: "ProjectEntity");

            migrationBuilder.DropTable(
                name: "ModelEndpointEntity");

            migrationBuilder.DropTable(
                name: "ModelEntity");

            migrationBuilder.DropTable(
                name: "ModelProviderEntity");
        }
    }
}
