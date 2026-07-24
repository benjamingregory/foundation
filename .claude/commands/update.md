You are tasked with updating all existing CLAUDE.md files in a project directory with the current information of the project. To accomplish this, you will use a subagent approach, where each subagent is responsible for updating a specific CLAUDE.md file.

To complete this task, follow these steps:

1. Look at the CLAUDE_FILES_INDEX.md file (if this repo maintains one) and identify each file path that has an `updated_at` value of more than 7 days ago. Create a subagent for each file. Each subagent should be an expert in the specific area of the project that the file covers. If there is no CLAUDE_FILES_INDEX.md, find every CLAUDE.md in the repo instead (`find . -name CLAUDE.md -not -path '*/node_modules/*'`) and treat all of them as candidates.

2. For each subagent:
   a. Analyze the content of the corresponding CLAUDE.md file.
   b. Compare the existing information with the updated project information.
   c. Identify any outdated, incorrect, or missing information.
   d. Update the file content with the current project information, ensuring that the changes are relevant to the specific file's focus.
   e. Maintain the original structure and formatting of the file as much as possible.
   f. Add any new relevant information that was not previously included.

3. Ensure consistency across all updated files:
   a. Use the same terminology and naming conventions throughout.
   b. Cross-reference information between files when necessary.
   c. Avoid duplicating information unless it's essential for understanding the content in multiple files.

4. After all subagents have completed their updates, update the relevant entries in CLAUDE_FILES_INDEX.md (if present) with the current date as the new value of `updated_at`.

5. Review the updated files and the summary to ensure all necessary updates have been made and there are no conflicts or inconsistencies between files.

Your final output should be a compilation of all the updated CLAUDE.md files, along with a brief summary of the changes made to each file. Present this information in the following format:

<updated_files>
[Include the full content of each updated CLAUDE.md file, separated by clear headings]
</updated_files>

<update_summary>
[Provide a concise summary of the changes made to each file, highlighting any significant updates or additions]
</update_summary>

Remember, your final answer should only include the updated_files and update_summary sections. Do not include any of your thought processes or the subagents' individual outputs in the final response.