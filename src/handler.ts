import {
  LambdaClient,
  GetFunctionCommand,
  UpdateFunctionCodeCommand,
} from "@aws-sdk/client-lambda"
import axios from "axios"
import { mkdtempSync, writeFileSync } from "fs"
import { resolve } from "path"
import { acquireLock, releaseLock } from "./locks"
import Zip from "adm-zip"
import type { OnEventHandler } from "aws-cdk-lib/custom-resources/lib/provider-framework/types"

const RETRY_INTERVAL_MS = 15000
const RETRY_ATTEMPTS = 6

export const handler: OnEventHandler = async (event) => {
  switch (event.RequestType) {
    case "Delete":
      return { PhysicalResourceId: event.PhysicalResourceId }
    case "Create":
    case "Update":
      console.log(JSON.stringify(event))

      const functionArnFull = event.ResourceProperties.FunctionArn as string
      const config = event.ResourceProperties.Config as Record<string, any>
      const lockTableName = getTableNameFromArn(config["locksTable"] as string)
      const functionArn = withoutVersion(functionArnFull)
      const lambda = new LambdaClient({
        region: getFunctionRegion(functionArn),
      })

      return createOrUpdateFunction(lambda, functionArn, config, lockTableName)
  }
}

function getTableNameFromArn(arn: string): string | undefined {
  const match = arn.match(/table\/([^/]+)/)
  return match ? match[1] : undefined
}

async function createOrUpdateFunction(
  lambda: LambdaClient,
  functionSimpleArn: string,
  config: Record<string, any>,
  lockTableName?: string,
) {
  const lockName = `${functionSimpleArn}-update-lock`
  if (lockTableName) {
    let acquireLockResult: boolean | null = null
    let retryCount = 0
    while (acquireLockResult === null || !acquireLockResult) {
      acquireLockResult = await acquireLock(lockTableName, lockName)
      if (!acquireLockResult) {
        retryCount++
        if (retryCount === RETRY_ATTEMPTS) {
          console.error(
            `Could not acquire lock to update function '${functionSimpleArn}' after ${retryCount} retries. Preparing to exit.`,
          )
          throw new Error(
            `Could not acquire lock to update function '${functionSimpleArn}`,
          )
        } else {
          console.log(
            `Could not acquire lock to update function '${functionSimpleArn}'. Retrying in ${
              RETRY_INTERVAL_MS / 1000
            } seconds...`,
          )
          await new Promise((resolve) => setTimeout(resolve, RETRY_INTERVAL_MS))
        }
      }
    }
  }

  try {
    const getCodeResponse = await lambda.send(
      new GetFunctionCommand({ FunctionName: functionSimpleArn }),
    )
    const { data } = await axios.get<Buffer>(getCodeResponse.Code!.Location!, {
      responseType: "arraybuffer",
    })

    const updateCodeResponse = await lambda.send(
      new UpdateFunctionCodeCommand({
        FunctionName: functionSimpleArn,
        ZipFile: addConfigToZip(data, config),
        Publish: true,
      }),
    )

    console.log(`Updated function '${functionSimpleArn}'`, updateCodeResponse)
    return {
      PhysicalResourceId: functionSimpleArn,
      Data: {
        CodeSha256: updateCodeResponse.CodeSha256,
        Version: updateCodeResponse.Version,
        FunctionArn: updateCodeResponse.FunctionArn,
      },
    }
  } catch (err) {
    console.error(`Error updating function '${functionSimpleArn}':`, err)
    throw err
  } finally {
    if (lockTableName) {
      await releaseLock(lockTableName, lockName)
    }
  }
}

function getFunctionRegion(arn: string): string {
  const match = /^arn:aws:lambda:([^:]+):/.exec(arn)
  if (!match) {
    throw new Error(`Could not extract region from '${arn}'`)
  }
  return match[1]
}

function withoutVersion(arn: string): string {
  const match = /^(arn:aws:lambda:[^:]+:[^:]+:function:[^:]+):[^:]+$/.exec(arn)
  if (!match) {
    return arn
  }
  return match[1]
}

function addConfigToZip(data: Buffer, config: Record<string, any>): Buffer {
  const lambdaZip = new Zip(data)
  const tempDir = mkdtempSync("/tmp/lambda-package")
  lambdaZip.extractAllTo(tempDir, true)
  writeFileSync(
    resolve(tempDir, "config.json"),
    JSON.stringify(config, null, 2),
  )

  const newLambdaZip = new Zip()
  newLambdaZip.addLocalFolder(tempDir)
  return newLambdaZip.toBuffer()
}
