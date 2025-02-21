<a name="top"></a>

<p align="center">
<img src="./docs/assets/IMG_0416.PNG" alt="aws-lambda-calculator" height="500" width="500" border="5"/>
</p>
<h1 align="center"><samp> AWS Lambda Calculator</samp></h1>

> [!NOTE]
> This project is a work in progress, and yet to be operational nor compelete.

# Introduction

## Back story

This project is the fruits of a hackaton idea I had about a year ago:\
The original idea was to provide users with a system to decide whether to go with the lambda serverless solution, or follow the more scallable kubernetes based solutions\.To do that, I needed a cost estimation for both solutions using the same configurations.\
I couldn't find a single calculator to support all configuration range values.

## The short version...

> Try to calculation a 10GB memory-use Lambda function, you simply can't. Calculators are capped somewhere in the 3GiB range.
Born as a result of a need to have a near accurate cost estination for Lambda functions on the AWS cloud. While doing some research Ive discovered the following:

1. The available calculators are limited, and does NOT allow for the wide range of configurations Lambda offers today. 
2. There is no API available (as-of-today) to allow to scripted / non-web based invokactions. This seriously reduces the changes of suchs calculators to be part of a FinOps tool / platform.

# The goals

Several goals are set for this project:\
1. Python package.
2. API.
3. Binary.
4. Docker Image.
5. Serverless based API (Lambda + Api gateway).
6. Web-based solution, using GitHub Pages.

# Installation
### 1. Python Package

```bash
python -m pip install git+https://github.com/zMynx/aws-lambda-calculator.git#egg=aws-lambda-calculator
```

### 2. API

```bash
## Clone the repo
git clone https://github.com/zMynx/aws-lambda-calculator.git

## Install the requirements
python -m pip install --requirementes requirements.txt
```

### 3. CLI

```bash
## Use the setup script
curl --remote-name https://github.com/zMynx/aws-lambda-calculator/blob/main/run.sh

## Run the setup.sh script
bash ./run.sh
```

### 4. Docker image

```bash
docker pull ghcr.io/zMynx/aws-lambda-calculator:latest
```

# Usage
Complete the [installation](#installation) steps first, then,\

### 1. Python Package

```python
import aws-lambda-calculator
```

### 2. API

```bash
python ./main.py --key=value....
```

### 3. CLI

```bash
aws-lambda-calculator --key=value....
```

### 4. Docker image

If you wish to use the API on any platform, without installing the binary, use the docker image.\

```bash
## Pull & use the image based api locally
docker run \
    --name aws-lambda-calculator \
    --interactive \
    --tty \
    --rm \
    --pull \
    --tag ghcr.io/zMynx/aws-lambda-calculator:latest \
    --args key=value...
```

### 5. Serverless API

The serverless API solution is based on a Lambda function, and can be used by invoking the endpoint, while providing a payload of the configurations to use.\
Endpoint: `https://zmynx.aws-lambda-calculator.com`\

e.g. (example using the cli)\

```bash
set ENDPOINT="https://zmynx.aws-lambda-calculator.com"
curl \
    --data '{"payload":{"key":"value"}}' \
    "${ENDPOINT}"

unset ENDPOINT
```

### 6. Web based solution

Navigate to `https://github.com/zMynx/aws-lambda-calculator.io`.

# :octocat: Report :octocat:

Encountered an issue? Think you've found a bug?\
Check our [closed issues](https://github.com/zMynx/aws-lambda-calculator/issues?q=is%3Aissue%20state%3Aclosed) tab for viable solutions,\
or create a new issue [here](https://github.com/zMynx/aws-lambda-calculator/issues/new/choose).

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

Enjoy our projects? make sure to follow for more!\
Want to keep enjoying great projects such as this? contribute to open source!\
<a href="buymeacoffee.com/zmynx"><img src="./docs/assets/buymeacoffe-logo.png" alt="buy-me-a-coffee" style="width:42px;height:42px;">Buy Me A Coffee !</a>
<br>
<br>
<img src="./docs/assets/bmc_qr.png" alt="buy-me-a-coffee-qr-code" style="width:80px;height:80px;"></a>

[:arrow_up:](#top) [Back to top](#top) [:arrow_up:](#top)
