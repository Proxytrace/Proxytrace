---
description: Execute the next pending item from REFACTORING-TODO.md. Use when the user wants to work through refactoring tasks one at a time, says "do the next refactor", or asks to process the refactoring list.
---

# Refactor

Execute the next pending item from `REFACTORING-TODO.md` at the repo root.

## Step 1 — Check the todo list

Read `REFACTORING-TODO.md`.

- **File does not exist or is empty:** Invoke the `/plan-refactor` skill to generate the list, then re-read the file before continuing.
- **All items are complete:** Tell the user the list is finished and suggest running `/plan-refactor` on a new scope if there is more to do. Stop here.
- **Items remain:** Identify the first item in the list. Proceed with that item.

## Step 2 — Understand the item

Read the item's **Scope**, **Priority**, and **Approach** carefully. Navigate to the files listed in Scope and read them in full before making any changes. If the approach references other files, read those too.

Do not begin editing until you have a clear picture of what needs to change and why.

## Step 3 — Implement the change

Carry out the refactoring described in the Approach bullets. Follow all conventions in CLAUDE.md for the relevant layer (backend or frontend). Specific rules:

- Do not expand scope beyond what the item describes.
- Do not fix unrelated issues you notice along the way — if they are worth fixing, they belong in the todo list.
- Do not add comments explaining what you changed; the code should be self-explanatory.
- If the item touches backend code, verify the build still passes: `dotnet build Proxytrace.sln`
- If the item touches frontend code, verify the TypeScript compiles: `npm run build` inside `frontend/`

## Step 4 — Remove the item from the list

Delete the completed item's entire section from `REFACTORING-TODO.md` — that means the heading line and all its body content (Scope, Priority, Approach, etc.). Do not renumber remaining items.

## Step 5 — Report back

Tell the user:
1. Which item was completed (number and title).
2. What files were changed and the nature of each change (one line per file).
3. Whether the build passed.
4. How many items remain on the list.
