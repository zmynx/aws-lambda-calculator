<a name="top"></a>

<p align="center">
<img src="./docs/assets/IMG_0416.PNG" alt="aws-lambda-calculator" height="500" width="500" border="5"/>
</p>
<h1 align="center"><samp> AWS Lambda Calculator</samp></h1>

> [!NOTE]
> This project is a work in progress, and yet to be operational nor compelete.

# Table of Contents :bookmark_tabs:

- [Introduction](#introduction)
  - [Back story](#back-story)
  - [The short version...](#the-short-version)
- [Installation & Usage](#installation--usage)
  - [Python Package](#1-python-package)
  - [API](#2-api)
  - [CLI](#3-cli)
  - [Docker image](#4-docker-image)
  - [Serverless API](#5-serverless-api)
  - [Web based solution](#6-web-based-solution)
- [Report](#octocat-report-octocat)
- [LICENSE](#license)
- [CONTRIBUTING](#contributing)
- [Show Appriciation](#show-appriciation)

# Introduction

## Back story

This project is the fruits of a hackaton idea I had about a year ago:\
The original idea was to provide users with a system to decide whether to go with the lambda serverless solution, or follow the more scallable kubernetes based solutions\.To do that, I needed a cost estimation for both solutions using the same configurations.\
_I couldn't find a single calculator to support all configuration range values._

## The short version...

> Try to calculation a 10GB memory-use Lambda function, you simply can't. Calculators are capped somewhere in the 3GiB range.

Born as a result of a need to have a near accurate cost estination for Lambda functions on the AWS cloud. While doing some research Ive discovered the following:

1. The available calculators are limited, and does NOT allow for the wide range of configurations Lambda offers today.
2. There is no API available (as-of-today) to allow to scripted / non-web based invokactions. This seriously reduces the changes of suchs calculators to be part of a FinOps tool / platform.

# Installation & Usage

### 1. Python Package

Install the package using pip (@<version> is optional, main is latest, use a version tag for a specific version):

```bash
python -m pip install aws-lambda-calculator@git+https://github.com/zmynx/aws-lambda-calculator#egg=aws-lambda-calculator&subdirectory=aws-lambda-calculator@main
```

Then import the package in your python code (.py):

```python
import aws_lambda_calculator
```

### 2. API

Clone the repository and install the requirements:

```bash
git clone https://github.com/zMynx/aws-lambda-calculator.git
python -m pip install --requirementes requirements.txt
```

Then run the main.py file with the required arguments:

```bash
python ./main.py --key=value....
```

### 3. CLI

Use the setup script to install the binary:

```bash
curl --remote-name https://github.com/zMynx/aws-lambda-calculator/blob/main/run.sh | bash -s -- --install
```

Then run the binary with the required arguments:

```bash
aws-lambda-calculator --key=value....
```

Optinally, use the alias `alc` for the binary:

```bash
alias alc=aws-lambda-calculator
alc --key=value....
```

### 4. Docker image

If you wish to use the API on any platform, without installing the binary, use the docker image.

Pull the image:

```bash
docker pull ghcr.io/zMynx/aws-lambda-calculator:latest
```

Then run the image with the required arguments:

```bash
docker run \
    --name aws-lambda-calculator \
    --interactive \
    --tty \
    --rm \
    --pull \
    --args key=value...
```

### 5. Serverless API

The serverless API solution is based on a Lambda function, and can be used by invoking the endpoint, while providing a payload of the configurations to use.\
Endpoint: `https://zmynx.aws-lambda-calculator.com`

e.g. (example using the cli)

```bash
curl \
    --data '{"payload":{"key":"value"}}' \
    https://zmynx.aws-lambda-calculator.com
```

### 6. Web based solution

Navigate to `https://github.com/zMynx/aws-lambda-calculator.io`.

# :octocat: Report :octocat:

Encountered an issue? Think you've found a bug?\
Check our [closed issues](https://github.com/zMynx/aws-lambda-calculator/issues?q=is%3Aissue%20state%3Aclosed) tab for viable solutions, or create a new issue [here](https://github.com/zMynx/aws-lambda-calculator/issues/new/choose).

# LICENSE

This project is under the served with the Apache License.\
Provided AS IS, no warranty given, not liability taken - USE AT YOUR OWN RISK.\
More info can be found in our [LICENSE file](./LICENSE).

# CONTRIBUTING

Shout out to:\
@zMyxx @alexmachulsky @itayyosef

Wanna contribute?\
Follow our [CONTRIBUTING](./docs/CONTRIBUTING) guide on our docs section.

# Show Appriciation

<img src="./docs/assets/bmc_qr.png" alt="buy-me-a-coffee-qr-code" style="width:80px;height:80px;"></a>

Enjoy our projects? make sure to follow for more!\
Want to keep enjoying great projects such as this? contribute to open source!

[:arrow_up:](#top) [Back to top](#top) [:arrow_up:](#top)
