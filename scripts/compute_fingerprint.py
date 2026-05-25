#!/usr/bin/env python3
"""
Computes the SHA-256 agent fingerprint that matches Proxytrace's AgentRepository.GetAgentFingerprint.

Algorithm (mirrors AgentRepository.cs lines 51-74):
  input = <system_prompt_text>
        + NUL
        + for each tool sorted by name:
            tool.Name + NUL + tool.Description + NUL + tool.Arguments.JsonSchema + NUL
        + NUL
        + model + NUL + provider

  fingerprint = SHA256(UTF-8(input)).hex().lower()

ToolArguments.JsonSchema is the JSON schema object serialised with 2-space indentation
(matching C# JsonSerializerOptions { WriteIndented = true }).

Usage:
  python3 compute_fingerprint.py
  python3 compute_fingerprint.py --agent customer_support
"""

import hashlib
import json
import sys


def make_tool_json_schema(properties: dict, required: list) -> str:
    """Build a JSON schema string with 2-space indentation (matches C# WriteIndented=true)."""
    schema = {"type": "object", "properties": properties, "required": required}
    return json.dumps(schema, indent=2)


NONE_SCHEMA = make_tool_json_schema({}, [])


def compute_fingerprint(system_prompt: str, tools: list[dict], model: str, provider: str) -> str:
    """
    tools: list of {"name": str, "description": str, "schema": str (JSON schema string)}
           where schema is the output of make_tool_json_schema.
    Tools are sorted by name (ordinal) inside this function — pass them in any order.
    """
    parts = [system_prompt, "\0"]

    for tool in sorted(tools, key=lambda t: t["name"]):
        parts.append(tool["name"])
        parts.append("\0")
        parts.append(tool["description"])
        parts.append("\0")
        parts.append(tool["schema"])
        parts.append("\0")

    parts.append("\0")
    parts.append(model)
    parts.append("\0")
    parts.append(provider)

    raw = "".join(parts)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


# ── Agent definitions ──────────────────────────────────────────────────────────

AGENTS = {
    "customer_support": {
        "system_prompt": (
            "You are a helpful customer support agent for TechShop, an online electronics retailer. "
            "Help customers with order tracking, refunds, and product availability. "
            "Always be professional, empathetic, and solution-focused."
        ),
        "model": "gpt-4o",
        "provider": "openai",
        "tools": [
            {
                "name": "check_inventory",
                "description": "Check the current inventory level for a product. Returns stock count and next restock date if applicable.",
                "schema": make_tool_json_schema(
                    {"product_id": {"type": "string", "description": "The product ID to check inventory for"}},
                    ["product_id"],
                ),
            },
            {
                "name": "lookup_order",
                "description": "Look up an order by its ID and return its current status, shipping information, and estimated delivery date.",
                "schema": make_tool_json_schema(
                    {"order_id": {"type": "string", "description": "The order ID to look up"}},
                    ["order_id"],
                ),
            },
            {
                "name": "process_refund",
                "description": "Process a refund for a given order. Returns a confirmation number and the expected processing time in business days.",
                "schema": make_tool_json_schema(
                    {
                        "order_id": {"type": "string", "description": "The order ID to refund"},
                        "reason": {"type": "string", "description": "The reason for the refund"},
                    },
                    ["order_id", "reason"],
                ),
            },
        ],
    },
    "code_review": {
        "system_prompt": (
            "You are an expert software engineer specialising in code review. "
            "Analyse code for bugs, security vulnerabilities, performance issues, and best-practice adherence. "
            "Provide clear, actionable, and constructive feedback with specific line references."
        ),
        "model": "claude-sonnet-4-6",
        "provider": "anthropic",
        "tools": [
            {
                "name": "check_lint",
                "description": "Run linting on the specified files and return a list of violations with severity levels.",
                "schema": make_tool_json_schema(
                    {"files": {"type": "string", "description": "Comma-separated list of file paths to lint"}},
                    ["files"],
                ),
            },
            {
                "name": "get_file",
                "description": "Retrieve the content of a source file from the repository.",
                "schema": make_tool_json_schema(
                    {"path": {"type": "string", "description": "Repository-relative path to the file"}},
                    ["path"],
                ),
            },
            {
                "name": "run_tests",
                "description": "Run the test suite matching the given pattern and return pass/fail results with error details.",
                "schema": make_tool_json_schema(
                    {"pattern": {"type": "string", "description": "Test name pattern or file glob to run"}},
                    ["pattern"],
                ),
            },
        ],
    },
    "data_analytics": {
        "system_prompt": (
            "You are a data analytics assistant. "
            "Help users explore datasets, write and execute SQL queries, and interpret results. "
            "Always explain your reasoning, suggest follow-up analyses, and flag data quality issues when you spot them."
        ),
        "model": "gpt-4o-mini",
        "provider": "openai",
        "tools": [
            {
                "name": "describe_table",
                "description": "Return the schema definition of a database table including column names, types, and constraints.",
                "schema": make_tool_json_schema(
                    {"table_name": {"type": "string", "description": "Name of the table to describe"}},
                    ["table_name"],
                ),
            },
            {
                "name": "list_tables",
                "description": "Return a list of all available tables in the database with their row counts.",
                "schema": NONE_SCHEMA,
            },
            {
                "name": "run_query",
                "description": "Execute a SQL SELECT query against the analytics database and return the result set as a JSON array.",
                "schema": make_tool_json_schema(
                    {"sql": {"type": "string", "description": "The SQL SELECT query to execute"}},
                    ["sql"],
                ),
            },
        ],
    },
}


def build_tools_json(tools: list[dict]) -> str:
    """Build the JSON for the AgentEntity.Tools column (compact, as stored by ToolArgumentsJsonConverter)."""
    result = []
    for tool in tools:
        schema_obj = json.loads(tool["schema"])
        result.append({
            "Name": tool["name"],
            "Description": tool["description"],
            "Arguments": schema_obj,
        })
    return json.dumps(result, separators=(",", ":"))


def build_system_message_json(prompt: str) -> str:
    """Build the JSON for the AgentEntity.SystemMessage column."""
    return json.dumps({"Contents": [{"Text": prompt}]}, separators=(",", ":"))


if __name__ == "__main__":
    target = sys.argv[1].replace("--agent=", "").replace("--agent", "") if len(sys.argv) > 1 else None

    for name, agent in AGENTS.items():
        if target and target not in (name, ""):
            continue

        fp = compute_fingerprint(
            agent["system_prompt"], agent["tools"], agent["model"], agent["provider"]
        )
        print(f"\n=== {name} ===")
        print(f"fingerprint : {fp}")
        print(f"model       : {agent['model']}")
        print(f"provider    : {agent['provider']}")
        print(f"system_msg  : {build_system_message_json(agent['system_prompt'])}")
        print(f"tools_json  : {build_tools_json(agent['tools'])}")
