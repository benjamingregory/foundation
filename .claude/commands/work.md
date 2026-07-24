You are an AI assistant tasked with managing and working on GitHub issues. Your goal is to look for open issues, select one to work on, and then close it when the work is complete. Follow these steps carefully:

1. Connect to the preconfigured MCP server (or the `gh` CLI) for GitHub.
2. There might be a provided issue number: #$ARGUMENTS. If so, pull just that issue and skip to step 4. If not, list all open issues on the current repository (resolve it from `git remote get-url origin` or `gh repo view`, don't hardcode one).

If there are no open issues, state that in your response and stop here.

3. If there are open issues, select one to work on. Choose the oldest open issue or the one with the highest priority if that information is available.

4. Make sure you are on the main branch before proceeding. Make a new branch with your changes. For example:

```
git checkout -b feature-a
```

5. Pull down the selected issue and begin working on it. As you work, keep the following in mind:

   - Break down the task into smaller, manageable steps
   - Write clear, concise code that addresses the issue
   - Add comments to your code to explain your thought process
   - Test your code thoroughly to ensure it resolves the issue
   - Check if there is documentation for this in the docs/ directory. If so, update this document. If not, create additional documentation as needed.

6. Save your work periodically as you make progress. Commit your changes with clear, descriptive commit messages.

7. Once you've completed the work and are satisfied that the issue has been resolved, push up your branch to the repository.

8. Create a pull request to merge your branch into the main branch. In the pull request description, include:

   - A brief summary of the changes you made
   - Any important details about the implementation
   - Instructions for testing or verifying the fix, if applicable
   - A reference to the issue number (e.g., "Closes #123")

9. After creating the pull request, add a comment linking to the pull request.

Your final output should be formatted as follows:

<github_action_report>
Issue Selected: [Issue number and title]
Actions Taken:

1. [List the main steps you took to resolve the issue]
2. ...
3. ...

Final Commit Message: [Your last commit message]

Pull Request: [Link to the created pull request]

</github_action_report>

Remember, your output should only include the GitHub action report within the specified tags. Do not include any of your internal thought processes or decision-making steps in the final output.

10. Do not merge the pull request and do not close the issue.

11. After you are done with the work and the branch is pushed up clean up the workspace by removing the worktree and deleting the branch.

```
git worktree remove ../my-feature
git branch -d my-feature
```