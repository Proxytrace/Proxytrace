using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Trsr.Storage.Migrations
{
    /// <inheritdoc />
    public partial class AddConversationToAgentCall : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Response",
                table: "AgentCallEntity");

            migrationBuilder.RenameColumn(
                name: "Request",
                table: "AgentCallEntity",
                newName: "ConversationJson");

            migrationBuilder.AddColumn<string>(
                name: "AgentMessageJson",
                table: "AgentCallEntity",
                type: "text",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AgentMessageJson",
                table: "AgentCallEntity");

            migrationBuilder.RenameColumn(
                name: "ConversationJson",
                table: "AgentCallEntity",
                newName: "Request");

            migrationBuilder.AddColumn<string>(
                name: "Response",
                table: "AgentCallEntity",
                type: "text",
                nullable: true);
        }
    }
}
