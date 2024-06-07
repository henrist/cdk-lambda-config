# CDK Construct for adding config.json file to a Lambda Function

When using Lambda@Edge, a function cannot use environment variables.
This CDK Construct uses a Custom Resource to inject a `config.json`
file with user provided values into an existing function, and
publishes a new version that is ready to be used as part of a
CloudFront Distribution.

Inspired by similar mechanism in https://github.com/aws-samples/cloudfront-authorization-at-edge/

## Usage

```bash
npm install @liflig/cdk-lambda-config
```

Using the construct:

```ts
const originalFunction = lambda.Function.fromFunctionArn(...)
const updatedFunction = new LambdaConfig(this, "UpdatedFunction", {
  function: originalFunction,
  config: {
    Key1: "Some value",
    Nested: {
      Key2: "Other value",
    },
  },
  nonce: "1", // See TSDoc.
})
// Can now retrieve the new version:
updatedFunction.version
```

Read from within the handler:

```ts
const fs = require("fs")
const path = require("path")
const config = JSON.parse(
  fs.readFileSync(path.join(__dirname, "config.json"), "utf-8"),
)
```
