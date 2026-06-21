using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Proxytrace.Storage.Migrations
{
    /// <inheritdoc />
    public partial class ProtectSecretsAtRest : Migration
    {
        // The verify-only secret columns are RENAMED (not dropped + re-added) so the existing
        // plaintext survives into the new column; the startup SecretsBackfillService then hashes /
        // encrypts each row in place. A drop + add would destroy live inbound API keys and pending
        // invite tokens before the backfill could read them. The provider key column is kept and
        // widened to hold ciphertext, with a nullable blind-index hash added alongside.
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // ── ModelProvider: encrypt-in-place (plaintext preserved) + nullable blind index ──
            migrationBuilder.DropIndex(
                name: "IX_ModelProviderEntity_ApiKey",
                table: "ModelProviderEntity");

            migrationBuilder.AlterColumn<string>(
                name: "ApiKey",
                table: "ModelProviderEntity",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(512)",
                oldMaxLength: 512);

            migrationBuilder.AddColumn<string>(
                name: "ApiKeyLookupHash",
                table: "ModelProviderEntity",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_ModelProviderEntity_ApiKeyLookupHash",
                table: "ModelProviderEntity",
                column: "ApiKeyLookupHash");

            // ── ApiKey: rename ApiKey → KeyHash (plaintext preserved) + nullable display prefix ──
            migrationBuilder.DropIndex(
                name: "IX_ApiKeyEntity_ApiKey",
                table: "ApiKeyEntity");

            migrationBuilder.RenameColumn(
                name: "ApiKey",
                table: "ApiKeyEntity",
                newName: "KeyHash");

            migrationBuilder.AlterColumn<string>(
                name: "KeyHash",
                table: "ApiKeyEntity",
                type: "character varying(64)",
                maxLength: 64,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(512)",
                oldMaxLength: 512);

            migrationBuilder.AddColumn<string>(
                name: "KeyPrefix",
                table: "ApiKeyEntity",
                type: "character varying(32)",
                maxLength: 32,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_ApiKeyEntity_KeyHash",
                table: "ApiKeyEntity",
                column: "KeyHash",
                unique: true);

            // ── Invite: rename Token → TokenHash (plaintext preserved) ──
            migrationBuilder.DropIndex(
                name: "IX_InviteEntity_Token",
                table: "InviteEntity");

            migrationBuilder.RenameColumn(
                name: "Token",
                table: "InviteEntity",
                newName: "TokenHash");

            migrationBuilder.AlterColumn<string>(
                name: "TokenHash",
                table: "InviteEntity",
                type: "character varying(64)",
                maxLength: 64,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.CreateIndex(
                name: "IX_InviteEntity_TokenHash",
                table: "InviteEntity",
                column: "TokenHash",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // ── Invite ──
            migrationBuilder.DropIndex(
                name: "IX_InviteEntity_TokenHash",
                table: "InviteEntity");

            migrationBuilder.AlterColumn<string>(
                name: "TokenHash",
                table: "InviteEntity",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(64)",
                oldMaxLength: 64);

            migrationBuilder.RenameColumn(
                name: "TokenHash",
                table: "InviteEntity",
                newName: "Token");

            migrationBuilder.CreateIndex(
                name: "IX_InviteEntity_Token",
                table: "InviteEntity",
                column: "Token",
                unique: true);

            // ── ApiKey ──
            migrationBuilder.DropIndex(
                name: "IX_ApiKeyEntity_KeyHash",
                table: "ApiKeyEntity");

            migrationBuilder.DropColumn(
                name: "KeyPrefix",
                table: "ApiKeyEntity");

            migrationBuilder.AlterColumn<string>(
                name: "KeyHash",
                table: "ApiKeyEntity",
                type: "character varying(512)",
                maxLength: 512,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(64)",
                oldMaxLength: 64);

            migrationBuilder.RenameColumn(
                name: "KeyHash",
                table: "ApiKeyEntity",
                newName: "ApiKey");

            migrationBuilder.CreateIndex(
                name: "IX_ApiKeyEntity_ApiKey",
                table: "ApiKeyEntity",
                column: "ApiKey",
                unique: true);

            // ── ModelProvider ──
            migrationBuilder.DropIndex(
                name: "IX_ModelProviderEntity_ApiKeyLookupHash",
                table: "ModelProviderEntity");

            migrationBuilder.DropColumn(
                name: "ApiKeyLookupHash",
                table: "ModelProviderEntity");

            migrationBuilder.AlterColumn<string>(
                name: "ApiKey",
                table: "ModelProviderEntity",
                type: "character varying(512)",
                maxLength: 512,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.CreateIndex(
                name: "IX_ModelProviderEntity_ApiKey",
                table: "ModelProviderEntity",
                column: "ApiKey");
        }
    }
}
