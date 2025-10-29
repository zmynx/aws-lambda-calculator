# Repository Coverage

[Full report](https://htmlpreview.github.io/?https://github.com/zmynx/aws-lambda-calculator/blob/python-coverage-comment-action-data/htmlcov/index.html)

| Name                                                              |    Stmts |     Miss |   Branch |   BrPart |   Cover |   Missing |
|------------------------------------------------------------------ | -------: | -------: | -------: | -------: | ------: | --------: |
| aws-lambda-calculator/src/aws\_lambda\_calculator/\_\_init\_\_.py |        2 |        0 |        0 |        0 |    100% |           |
| aws-lambda-calculator/src/aws\_lambda\_calculator/calculator.py   |      191 |        1 |       42 |        2 |     99% |151->157, 328 |
| aws-lambda-calculator/src/aws\_lambda\_calculator/models.py       |       31 |        4 |       16 |        6 |     79% |57, 58->63, 60, 65, 68->74, 70 |
| src/aws\_lambda.py                                                |       44 |        0 |        8 |        0 |    100% |           |
| src/utils/\_\_init\_\_.py                                         |        0 |        0 |        0 |        0 |    100% |           |
| src/utils/logger.py                                               |       21 |        0 |        0 |        0 |    100% |           |
| tests/test\_cli.py                                                |       63 |        0 |        0 |        0 |    100% |           |
| tests/test\_coverage\_gaps.py                                     |       94 |        0 |        2 |        0 |    100% |           |
| tests/test\_edge\_cases.py                                        |       81 |        0 |        6 |        0 |    100% |           |
| tests/test\_error\_handling.py                                    |      105 |        0 |        0 |        0 |    100% |           |
| tests/test\_free\_tier.py                                         |       74 |        0 |        0 |        0 |    100% |           |
| tests/test\_lambda.py                                             |       68 |        0 |        0 |        0 |    100% |           |
|                                                         **TOTAL** |  **774** |    **5** |   **74** |    **8** | **98%** |           |


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