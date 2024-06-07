// Cheating a bit as it seems the type is not available in the export.
// TODO: Duplicate the relevant type parts?
import Zip from "adm-zip"
import type { OnEventHandler } from "aws-cdk-lib/custom-resources/lib/provider-framework/types"
import {
  LambdaClient,
  GetFunctionCommand,
  UpdateFunctionCodeCommand,
} from "@aws-sdk/client-lambda"
import axios from "axios"
import { mkdtempSync, writeFileSync } from "fs"
import { resolve } from "path"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Config = Record<string, any>

export const handler: OnEventHandler = async (event) => {
  switch (event.RequestType) {
    case "Delete":
      // Nothing to do on delete.
      return {
        PhysicalResourceId: event.PhysicalResourceId,
      }

    case "Create":
    case "Update":
      console.log(JSON.stringify(event))

      const functionArnFull = event.ResourceProperties.FunctionArn as string
      const config = event.ResourceProperties.Config as Config

      const functionArn = withoutVersion(functionArnFull)
      console.log(`Modifying function '${functionArnFull}'`)

      const lambdaClient = new LambdaClient({
        region: getFunctionRegion(functionArn),
      })

      const { Code } = await lambdaClient.send(
        new GetFunctionCommand({
          FunctionName: functionArn,
        }),
      )

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const { data } = await axios.get<Buffer>(Code!.Location!, {
        responseType: "arraybuffer",
      })

      const { CodeSha256, Version, FunctionArn } = await lambdaClient.send(
        new UpdateFunctionCodeCommand({
          FunctionName: functionArn,
          ZipFile: addConfigToZip(data, config),
          Publish: true,
        }),
      )

      console.log("Updated function", { CodeSha256, Version, FunctionArn })

      return {
        PhysicalResourceId: functionArn,
        Data: { CodeSha256, Version, FunctionArn },
      }
  }
}

function getFunctionRegion(arn: string): string {
  // Example value: arn:aws:lambda:eu-west-1:112233445566:function:my-function
  // Result: eu-west-1
  const match = /^arn:aws:lambda:([^:]+):/.exec(arn)
  if (!match) {
    throw new Error(`Could not extract region from '${arn}'`)
  }
  return match[1]
}

function withoutVersion(arn: string): string {
  // Example value: arn:aws:lambda:eu-west-1:112233445566:function:my-function:1
  // Result: arn:aws:lambda:eu-west-1:112233445566:function:my-function
  const match = /^(arn:aws:lambda:[^:]+:[^:]+:function:[^:]+):[^:]+$/.exec(arn)
  if (!match) {
    return arn
  }
  return match[1]
}

function addConfigToZip(data: Buffer, config: Config): Buffer {
  const lambdaZip = new Zip(data)
  const tempDir = mkdtempSync("/tmp/lambda-package")
  lambdaZip.extractAllTo(tempDir, true)
  writeFileSync(
    resolve(tempDir, "config.json"),
    Buffer.from(JSON.stringify(config, null, 2)),
  )

  const newLambdaZip = new Zip()
  newLambdaZip.addLocalFolder(tempDir)
  return newLambdaZip.toBuffer()
}
