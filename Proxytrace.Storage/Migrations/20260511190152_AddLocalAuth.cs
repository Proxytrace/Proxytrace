#nullable disable

using Microsoft.EntityFrameworkCore.Migrations;

namespace Proxytrace.Storage.Migrations
{
    /// <inheritdoc />
    public partial class AddLocalAuth : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_UserEntity_Email",
                table: "UserEntity");

            migrationBuilder.DropIndex(
                name: "IX_UserEntity_ExternalSubject",
                table: "UserEntity");

            migrationBuilder.DropIndex(
                name: "IX_UserEntity_Name",
                table: "UserEntity");

            migrationBuilder.DropColumn(
                name: "Name",
                table: "UserEntity");

            migrationBuilder.AlterColumn<string>(
                name: "ExternalSubject",
                table: "UserEntity",
                type: "TEXT",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "TEXT");

            migrationBuilder.AddColumn<string>(
                name: "PasswordHash",
                table: "UserEntity",
                type: "TEXT",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "InviteEntity",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Email = table.Column<string>(type: "TEXT", nullable: false),
                    Role = table.Column<int>(type: "INTEGER", nullable: false),
                    Token = table.Column<string>(type: "TEXT", nullable: false),
                    ExpiresAt = table.Column<string>(type: "TEXT", nullable: false),
                    ConsumedAt = table.Column<DateTimeOffset>(type: "TEXT", nullable: true),
                    InvitedBy = table.Column<Guid>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<string>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<string>(type: "TEXT", nullable: false)
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
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "InviteEntity");

            migrationBuilder.DropIndex(
                name: "IX_UserEntity_Email",
                table: "UserEntity");

            migrationBuilder.DropIndex(
                name: "IX_UserEntity_ExternalSubject",
                table: "UserEntity");

            migrationBuilder.DropColumn(
                name: "PasswordHash",
                table: "UserEntity");

            migrationBuilder.AlterColumn<string>(
                name: "ExternalSubject",
                table: "UserEntity",
                type: "TEXT",
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "TEXT",
                oldNullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Name",
                table: "UserEntity",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "IX_UserEntity_Email",
                table: "UserEntity",
                column: "Email");

            migrationBuilder.CreateIndex(
                name: "IX_UserEntity_ExternalSubject",
                table: "UserEntity",
                column: "ExternalSubject",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_UserEntity_Name",
                table: "UserEntity",
                column: "Name",
                unique: true);
        }
    }
}
