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
