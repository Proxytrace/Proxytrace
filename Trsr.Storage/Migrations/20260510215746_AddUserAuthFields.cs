using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Trsr.Storage.Migrations
{
    /// <inheritdoc />
    public partial class AddUserAuthFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Email",
                table: "UserEntity",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ExternalSubject",
                table: "UserEntity",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "Role",
                table: "UserEntity",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);

            // Backfill existing rows so the unique index on ExternalSubject can be created
            // and so legacy single-user installs still have a working admin.
            migrationBuilder.Sql(
                "UPDATE \"UserEntity\" SET " +
                "\"Email\" = \"Name\" || '@local', " +
                "\"ExternalSubject\" = 'legacy:' || \"Id\", " +
                "\"Role\" = 2 " +
                "WHERE \"ExternalSubject\" = '';");

            migrationBuilder.CreateIndex(
                name: "IX_UserEntity_Email",
                table: "UserEntity",
                column: "Email");

            migrationBuilder.CreateIndex(
                name: "IX_UserEntity_ExternalSubject",
                table: "UserEntity",
                column: "ExternalSubject",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_UserEntity_Email",
                table: "UserEntity");

            migrationBuilder.DropIndex(
                name: "IX_UserEntity_ExternalSubject",
                table: "UserEntity");

            migrationBuilder.DropColumn(
                name: "Email",
                table: "UserEntity");

            migrationBuilder.DropColumn(
                name: "ExternalSubject",
                table: "UserEntity");

            migrationBuilder.DropColumn(
                name: "Role",
                table: "UserEntity");
        }
    }
}
