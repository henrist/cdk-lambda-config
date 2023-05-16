import {
  aws_iam as iam,
  aws_lambda as lambda,
  CustomResource,
  custom_resources as cr,
  Duration,
  Stack,
} from "aws-cdk-lib"
import { Construct } from "constructs"
import * as path from "path"
export interface LambdaConfigProps {
  /**
   * The Lambda Function to be updated.
   *
   * If this points to a specific version, the version qualifier
   * will be ignored, but will be used for invalidation instead
   * of providing a separate nonce value.
   *
   * A Lambda Function can only receive a new version based on
   * the latest version.
   */
  function: lambda.IFunction
  /**
   * The configuration to be added to the Lambda Function. Must be
   * a valid JSON structure and cannot contain null values since it
   * is not supported by CloudFormation custom resource properties.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config: Record<string, any>
  /**
   * Nonce to force new version.
   *
   * If the function provided does not point to a specific
   * version, specify nonce to ensure the function is updated
   * after every change.
   */
  nonce?: string
}

/**
 * Modify a Lambda Function by adding a config.json file using
 * the provided object, and provide a new version for the
 * Lambda Function.
 */
export class LambdaConfig extends Construct {
  public readonly version: lambda.IVersion

  constructor(scope: Construct, id: string, props: LambdaConfigProps) {
    super(scope, id)
    const lambdaConfigProvider = LambdaConfigProvider.getOrCreate(this, {
      locksTableArn: props.config?.locksTable as string,
    })

    const updateCodeResource = new CustomResource(this, "Resource", {
      serviceToken: lambdaConfigProvider.serviceToken,
      properties: {
        FunctionArn: props.function.functionArn,
        Config: props.config,
        Nonce: props.nonce ?? "",
      },
    })

    this.version = lambda.Version.fromVersionArn(
      this,
      "Version",
      updateCodeResource.getAttString("FunctionArn"),
    )
  }
}

interface LambdaConfigProviderProps {
  locksTableArn: string
}

class LambdaConfigProvider extends Construct {
  /**
   * Returns the singleton provider.
   */
  public static getOrCreate(
    scope: Construct,
    props: LambdaConfigProviderProps,
  ) {
    const stack = Stack.of(scope)
    const id = "henrist.lambda-config.provider"
    return (
      (stack.node.tryFindChild(id) as LambdaConfigProvider) ||
      new LambdaConfigProvider(stack, id, props)
    )
  }

  private readonly provider: cr.Provider
  public readonly serviceToken: string

  constructor(scope: Construct, id: string, props: LambdaConfigProviderProps) {
    super(scope, id)
    const statements = [
      new iam.PolicyStatement({
        actions: ["lambda:GetFunction", "lambda:UpdateFunctionCode"],
        resources: ["*"],
      }),
    ]

    if (props.locksTableArn) {
      statements.push(
        new iam.PolicyStatement({
          actions: ["dynamodb:PutItem", "dynamodb:DeleteItem"],
          resources: [props.locksTableArn],
        }),
      )
    }

    this.provider = new cr.Provider(this, "Provider", {
      onEventHandler: new lambda.Function(this, "UpdateCodeFn", {
        code: lambda.Code.fromAsset(path.join(__dirname, "../dist/handler")),
        handler: "index.handler",
        runtime: lambda.Runtime.NODEJS_16_X,
        timeout: Duration.seconds(120),
        initialPolicy: statements,
      }),
    })

    this.serviceToken = this.provider.serviceToken
  }
}
