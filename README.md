# Repository Coverage

[Full report](https://htmlpreview.github.io/?https://github.com/zmynx/aws-lambda-calculator/blob/python-coverage-comment-action-data/htmlcov/index.html)

| Name                                                 |    Stmts |     Miss |   Branch |   BrPart |   Cover |   Missing |
|----------------------------------------------------- | -------: | -------: | -------: | -------: | ------: | --------: |
| src/aws\_lambda\_calculator/\_\_init\_\_.py          |        2 |        0 |        0 |        0 |    100% |           |
| src/aws\_lambda\_calculator/calculator.py            |      165 |        1 |       42 |        5 |     97% |155->158, 173->182, 260->267, 375, 381->384 |
| src/aws\_lambda\_calculator/models.py                |       31 |        0 |       16 |        2 |     96% |58->63, 68->74 |
| tests/\_\_init\_\_.py                                |        0 |        0 |        0 |        0 |    100% |           |
| tests/test\_calculator.py                            |        9 |        0 |        0 |        0 |    100% |           |
| tests/test\_calculator\_coverage.py                  |      100 |        0 |        0 |        0 |    100% |           |
| tests/test\_models.py                                |      141 |        0 |        0 |        0 |    100% |           |
| tests/test\_pytest\_generate\_tests\_sample\_code.py |       10 |        0 |        2 |        1 |     92% |  70->exit |
|                                            **TOTAL** |  **458** |    **1** |   **60** |    **8** | **98%** |           |


## Setup coverage badge

Below are examples of the badges you can use in your main branch `README` file.

### Direct image

[![Coverage badge](https://raw.githubusercontent.com/zmynx/aws-lambda-calculator/python-coverage-comment-action-data/badge.svg)](https://htmlpreview.github.io/?https://github.com/zmynx/aws-lambda-calculator/blob/python-coverage-comment-action-data/htmlcov/index.html)

This is the one to use if your repository is private or if you don't want to customize anything.

### [Shields.io](https://shields.io) Json Endpoint

[![Coverage badge](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/zmynx/aws-lambda-calculator/python-coverage-comment-action-data/endpoint.json)](https://htmlpreview.github.io/?https://github.com/zmynx/aws-lambda-calculator/blob/python-coverage-comment-action-data/htmlcov/index.html)

Using this one will allow you to [customize](https://shields.io/endpoint) the look of your badge.
It won't work with private repositories. It won't be refreshed more than once per five minutes.

### [Shields.io](https://shields.io) Dynamic Badge

[![Coverage badge](https://img.shields.io/badge/dynamic/json?color=brightgreen&label=coverage&query=%24.message&url=https%3A%2F%2Fraw.githubusercontent.com%2Fzmynx%2Faws-lambda-calculator%2Fpython-coverage-comment-action-data%2Fendpoint.json)](https://htmlpreview.github.io/?https://github.com/zmynx/aws-lambda-calculator/blob/python-coverage-comment-action-data/htmlcov/index.html)

This one will always be the same color. It won't work for private repos. I'm not even sure why we included it.

## What is that?

This branch is part of the
[python-coverage-comment-action](https://github.com/marketplace/actions/python-coverage-comment)
GitHub Action. All the files in this branch are automatically generated and may be
overwritten at any moment.