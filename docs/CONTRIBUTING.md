Thank you for taking an interest in contributing to zMynx's open source projects!

## Issues

- Feel free to open an issue for any reason as long as you make it clear if the issue is about a bug/feature/question/comment.
- Please spend some time giving due diligence to the issue tracker. Your issue might be a duplicate. If it is, please add your comment to the existing issue.
- Remember, users might be searching for your issue in the future. So please give it a meaningful title to help others.
- The issue should clearly explain the reason for opening the proposal if you have any, along with any relevant technical information.
- For questions and bug reports, please include the output you're seeing (using debug logging where possible) and describe what is different from what you expected to see.

## Pull Requests

1. Every Pull Request should have an associated Issue, unless you are fixing a trivial documentation issue.
2. We will not accept changes to LICENSE, NOTICE or CONTRIBUTING from outside the zMynx Security team. Please raise an Issue if you believe there is a problem with any of these files. 
3. Your PR is more likely to be accepted if it focuses on just one change.
4. Describe what the PR does. There's no convention enforced, but please try to be concise and descriptive. Treat the PR description as a commit message. Titles that start with "fix"/"add"/"improve"/"remove" are good examples.
5. Please add the associated Issue in the PR description.
6. Please include a comment with the results before and after your change.
7. There's no need to add or tag reviewers.
8. If a reviewer commented on your code or asked for changes, please remember to mark the discussion as resolved after you address it. PRs with unresolved issues should not be merged (even if the comment is unclear or requires no action from your side).
9. Your PR is more likely to be accepted if it includes tests.

## Code Standards

1. Python code to be written in snake_case and type hinted. You code should be readable and simple.
2. Our codebase contains a `.justfile` free for use, it will make youre life easier.
3. Code must pass the following "Code Standards" checks:

- [ ] `ruff format --check`
- [ ] `ruff check`
- [ ] `black --check .`
- [ ] `mypy --check-untyped-defs .`

which are validated in our CI as part of the PR status checks. If your code fails the checks, it can be fixed locally by running `just checks`.
4. Explicit decleration is always better.
5. Use long flags `--version` instead of short `-v` whenever possible.
6. Always think about security when writing code, and explore how it can be done better.
7. FOLLOW BEST PRACTICES.
8. Document when needed, especially when completing a task with a PR or passing on a task to a fellow contributer.
