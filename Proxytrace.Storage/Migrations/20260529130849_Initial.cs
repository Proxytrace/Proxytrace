using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Proxytrace.Storage.Migrations
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
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Kind = table.Column<int>(type: "integer", nullable: false),
                    Project = table.Column<Guid>(type: "uuid", nullable: false),
                    Data = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EvaluatorEntity", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ModelEntity",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ModelEntity", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ModelProviderEntity",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    Endpoint = table.Column<string>(type: "character varying(2048)", maxLength: 2048, nullable: false),
                    ApiKey = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    Kind = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ModelProviderEntity", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "TestCaseEntity",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Input = table.Column<string>(type: "text", nullable: false),
                    ExpectedOutput = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TestCaseEntity", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "UserEntity",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Email = table.Column<string>(type: "text", nullable: false),
                    ExternalSubject = table.Column<string>(type: "text", nullable: true),
                    PasswordHash = table.Column<string>(type: "text", nullable: true),
                    Role = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserEntity", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ModelEndpointEntity",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Model = table.Column<Guid>(type: "uuid", nullable: false),
                    Provider = table.Column<Guid>(type: "uuid", nullable: false),
                    InputTokenCost = table.Column<decimal>(type: "numeric(18,6)", precision: 18, scale: 6, nullable: true),
                    OutputTokenCost = table.Column<decimal>(type: "numeric(18,6)", precision: 18, scale: 6, nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
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
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TestCase = table.Column<Guid>(type: "uuid", nullable: false),
                    ActualResponse = table.Column<string>(type: "text", nullable: false),
                    Evaluations = table.Column<string>(type: "text", nullable: false),
                    DurationMs = table.Column<long>(type: "bigint", nullable: false),
                    InputTokens = table.Column<long>(type: "bigint", nullable: true),
                    OutputTokens = table.Column<long>(type: "bigint", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
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
                name: "InviteEntity",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Email = table.Column<string>(type: "text", nullable: false),
                    Role = table.Column<int>(type: "integer", nullable: false),
                    Token = table.Column<string>(type: "text", nullable: false),
                    ExpiresAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    ConsumedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    InvitedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InviteEntity", x => x.Id);
                    table.ForeignKey(
                        name: "FK_InviteEntity_UserEntity_InvitedBy",
                        column: x => x.InvitedBy,
                        principalTable: "UserEntity",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ProjectEntity",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    SystemEndpoint = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
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
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Project = table.Column<Guid>(type: "uuid", nullable: false),
                    Endpoint = table.Column<Guid>(type: "uuid", nullable: false),
                    IsSystemAgent = table.Column<bool>(type: "boolean", nullable: false),
                    ModelParameters = table.Column<string>(type: "text", nullable: false),
                    CurrentVersionId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
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
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    ApiKey = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    Project = table.Column<Guid>(type: "uuid", nullable: false),
                    Provider = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
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
                name: "ProjectSearchSettingsEntity",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Project = table.Column<Guid>(type: "uuid", nullable: false),
                    Enabled = table.Column<bool>(type: "boolean", nullable: false),
                    IndexedKinds = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    AutoReindexOnChange = table.Column<bool>(type: "boolean", nullable: false),
                    SnippetLength = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProjectSearchSettingsEntity", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProjectSearchSettingsEntity_ProjectEntity_Project",
                        column: x => x.Project,
                        principalTable: "ProjectEntity",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ProjectUserEntity",
                columns: table => new
                {
                    ProjectId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false)
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
                name: "AgentVersionEntity",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AgentId = table.Column<Guid>(type: "uuid", nullable: false),
                    Project = table.Column<Guid>(type: "uuid", nullable: false),
                    VersionNumber = table.Column<int>(type: "integer", nullable: false),
                    SystemPrompt = table.Column<string>(type: "text", nullable: false),
                    Tools = table.Column<string>(type: "text", nullable: false),
                    Fingerprint = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    LooseFingerprint = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AgentVersionEntity", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AgentVersionEntity_AgentEntity_AgentId",
                        column: x => x.AgentId,
                        principalTable: "AgentEntity",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_AgentVersionEntity_ProjectEntity_Project",
                        column: x => x.Project,
                        principalTable: "ProjectEntity",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "TestSuiteEntity",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Agent = table.Column<Guid>(type: "uuid", nullable: false),
                    TestCases = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
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
                name: "AgentCallEntity",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AgentVersionId = table.Column<Guid>(type: "uuid", nullable: false),
                    EndpointId = table.Column<Guid>(type: "uuid", nullable: false),
                    Request = table.Column<string>(type: "text", nullable: false),
                    Response = table.Column<string>(type: "text", nullable: true),
                    InputTokens = table.Column<decimal>(type: "numeric(20,0)", nullable: true),
                    OutputTokens = table.Column<decimal>(type: "numeric(20,0)", nullable: true),
                    LatencyMs = table.Column<double>(type: "double precision", nullable: true),
                    HttpStatus = table.Column<int>(type: "integer", nullable: false),
                    FinishReason = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    ErrorMessage = table.Column<string>(type: "character varying(2048)", maxLength: 2048, nullable: true),
                    ModelParameters = table.Column<string>(type: "text", nullable: false),
                    ConversationId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AgentCallEntity", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AgentCallEntity_AgentVersionEntity_AgentVersionId",
                        column: x => x.AgentVersionId,
                        principalTable: "AgentVersionEntity",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_AgentCallEntity_ModelEndpointEntity_EndpointId",
                        column: x => x.EndpointId,
                        principalTable: "ModelEndpointEntity",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TestRunGroupEntity",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Suite = table.Column<Guid>(type: "uuid", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    CompletedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
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
                    TestSuiteId = table.Column<Guid>(type: "uuid", nullable: false),
                    EvaluatorId = table.Column<Guid>(type: "uuid", nullable: false)
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
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Group = table.Column<Guid>(type: "uuid", nullable: false),
                    Endpoint = table.Column<Guid>(type: "uuid", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    CompletedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    TestResults = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
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

            migrationBuilder.CreateTable(
                name: "OptimizationProposalEntity",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Agent = table.Column<Guid>(type: "uuid", nullable: false),
                    Kind = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    Priority = table.Column<int>(type: "integer", nullable: false),
                    Rationale = table.Column<string>(type: "text", nullable: false),
                    ABTestRun = table.Column<Guid>(type: "uuid", nullable: false),
                    Data = table.Column<string>(type: "text", nullable: false),
                    EvidenceTestRunIds = table.Column<string>(type: "text", nullable: false),
                    CurrentPassRate = table.Column<double>(type: "double precision", nullable: true),
                    ProposedPassRate = table.Column<double>(type: "double precision", nullable: true),
                    ContentHash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
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
                    table.ForeignKey(
                        name: "FK_OptimizationProposalEntity_TestRunEntity_ABTestRun",
                        column: x => x.ABTestRun,
                        principalTable: "TestRunEntity",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "TestRunStatsEntity",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TestRunId = table.Column<Guid>(type: "uuid", nullable: false),
                    AgentId = table.Column<Guid>(type: "uuid", nullable: false),
                    EndpointId = table.Column<Guid>(type: "uuid", nullable: false),
                    GroupId = table.Column<Guid>(type: "uuid", nullable: false),
                    SuiteId = table.Column<Guid>(type: "uuid", nullable: false),
                    TestCases = table.Column<int>(type: "integer", nullable: false),
                    Passed = table.Column<int>(type: "integer", nullable: false),
                    InputTokens = table.Column<long>(type: "bigint", nullable: true),
                    OutputTokens = table.Column<long>(type: "bigint", nullable: true),
                    TotalDurationMicroseconds = table.Column<long>(type: "bigint", nullable: true),
                    Cost = table.Column<decimal>(type: "numeric", nullable: true),
                    RunCompletedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TestRunStatsEntity", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TestRunStatsEntity_TestRunEntity_TestRunId",
                        column: x => x.TestRunId,
                        principalTable: "TestRunEntity",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AgentCallEntity_AgentVersionId",
                table: "AgentCallEntity",
                column: "AgentVersionId");

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
                name: "IX_AgentEntity_IsSystemAgent",
                table: "AgentEntity",
                column: "IsSystemAgent");

            migrationBuilder.CreateIndex(
                name: "IX_AgentEntity_Project",
                table: "AgentEntity",
                column: "Project");

            migrationBuilder.CreateIndex(
                name: "IX_AgentVersionEntity_AgentId",
                table: "AgentVersionEntity",
                column: "AgentId");

            migrationBuilder.CreateIndex(
                name: "IX_AgentVersionEntity_AgentId_VersionNumber",
                table: "AgentVersionEntity",
                columns: new[] { "AgentId", "VersionNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_AgentVersionEntity_Project_Fingerprint",
                table: "AgentVersionEntity",
                columns: new[] { "Project", "Fingerprint" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_AgentVersionEntity_Project_LooseFingerprint",
                table: "AgentVersionEntity",
                columns: new[] { "Project", "LooseFingerprint" });

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
                name: "IX_InviteEntity_Email",
                table: "InviteEntity",
                column: "Email");

            migrationBuilder.CreateIndex(
                name: "IX_InviteEntity_InvitedBy",
                table: "InviteEntity",
                column: "InvitedBy");

            migrationBuilder.CreateIndex(
                name: "IX_InviteEntity_Token",
                table: "InviteEntity",
                column: "Token",
                unique: true);

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
                name: "IX_ModelProviderEntity_ApiKey",
                table: "ModelProviderEntity",
                column: "ApiKey");

            migrationBuilder.CreateIndex(
                name: "IX_ModelProviderEntity_Name",
                table: "ModelProviderEntity",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_OptimizationProposalEntity_ABTestRun",
                table: "OptimizationProposalEntity",
                column: "ABTestRun");

            migrationBuilder.CreateIndex(
                name: "IX_OptimizationProposalEntity_Agent",
                table: "OptimizationProposalEntity",
                column: "Agent");

            migrationBuilder.CreateIndex(
                name: "IX_OptimizationProposalEntity_Agent_ContentHash",
                table: "OptimizationProposalEntity",
                columns: new[] { "Agent", "ContentHash" });

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
                name: "IX_ProjectSearchSettingsEntity_Project",
                table: "ProjectSearchSettingsEntity",
                column: "Project",
                unique: true);

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
                name: "IX_TestRunStatsEntity_AgentId",
                table: "TestRunStatsEntity",
                column: "AgentId");

            migrationBuilder.CreateIndex(
                name: "IX_TestRunStatsEntity_EndpointId",
                table: "TestRunStatsEntity",
                column: "EndpointId");

            migrationBuilder.CreateIndex(
                name: "IX_TestRunStatsEntity_GroupId",
                table: "TestRunStatsEntity",
                column: "GroupId");

            migrationBuilder.CreateIndex(
                name: "IX_TestRunStatsEntity_RunCompletedAt",
                table: "TestRunStatsEntity",
                column: "RunCompletedAt");

            migrationBuilder.CreateIndex(
                name: "IX_TestRunStatsEntity_SuiteId",
                table: "TestRunStatsEntity",
                column: "SuiteId");

            migrationBuilder.CreateIndex(
                name: "IX_TestRunStatsEntity_TestRunId",
                table: "TestRunStatsEntity",
                column: "TestRunId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TestSuiteEntity_Agent",
                table: "TestSuiteEntity",
                column: "Agent");

            migrationBuilder.CreateIndex(
                name: "IX_TestSuiteEvaluatorEntity_EvaluatorId",
                table: "TestSuiteEvaluatorEntity",
                column: "EvaluatorId");

            migrationBuilder.CreateIndex(
                name: "IX_UserEntity_Email",
                table: "UserEntity",
                column: "Email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_UserEntity_ExternalSubject",
                table: "UserEntity",
                column: "ExternalSubject",
                unique: true,
                filter: "\"ExternalSubject\" IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AgentCallEntity");

            migrationBuilder.DropTable(
                name: "ApiKeyEntity");

            migrationBuilder.DropTable(
                name: "InviteEntity");

            migrationBuilder.DropTable(
                name: "OptimizationProposalEntity");

            migrationBuilder.DropTable(
                name: "ProjectSearchSettingsEntity");

            migrationBuilder.DropTable(
                name: "ProjectUserEntity");

            migrationBuilder.DropTable(
                name: "TestResultEntity");

            migrationBuilder.DropTable(
                name: "TestRunStatsEntity");

            migrationBuilder.DropTable(
                name: "TestSuiteEvaluatorEntity");

            migrationBuilder.DropTable(
                name: "AgentVersionEntity");

            migrationBuilder.DropTable(
                name: "UserEntity");

            migrationBuilder.DropTable(
                name: "TestCaseEntity");

            migrationBuilder.DropTable(
                name: "TestRunEntity");

            migrationBuilder.DropTable(
                name: "EvaluatorEntity");

            migrationBuilder.DropTable(
                name: "TestRunGroupEntity");

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
