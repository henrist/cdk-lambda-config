import * as lambda from "@aws-cdk/aws-lambda"
import * as cdk from "@aws-cdk/core"
import "jest-cdk-snapshot"
import { LambdaConfig } from "."

test("LambdaConfig", () => {
  const app = new cdk.App()
  const stack = new cdk.Stack(app, "Stack", {
    env: {
      account: "112233445566",
      region: "eu-west-1",
    },
  })

  const fn = new lambda.Function(stack, "Fn", {
    code: lambda.Code.fromInline("code"),
    handler: "index.handler",
    runtime: lambda.Runtime.NODEJS_12_X,
  })

  const fnWithConfig = new LambdaConfig(stack, "LambdaConfig", {
    function: fn,
    config: {
      My: "value",
      Deep: {
        ObjectKey: "Hello world",
      },
    },
  })

  expect(fnWithConfig.version.functionArn).toContain("${Token[TOKEN")
  expect(stack).toMatchCdkSnapshot({
    ignoreAssets: true,
  })
})
