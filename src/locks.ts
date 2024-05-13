import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import { PutCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb"

const dynamoDBClient = new DynamoDBClient({
  region: "us-east-1",
})

export const acquireLock = async (
  tableName: string,
  lockName: string,
): Promise<boolean> => {
  const params = {
    TableName: tableName,
    Item: {
      LockName: lockName,
    },
    ConditionExpression: "attribute_not_exists(LockName)",
  }

  try {
    await dynamoDBClient.send(new PutCommand(params))
    return true
  } catch (err) {
    if (
      err instanceof Error &&
      err.name === "ConditionalCheckFailedException"
    ) {
      return false
    }
    throw err
  }
}

export const releaseLock = async (
  tableName: string,
  lockName: string,
): Promise<boolean> => {
  const params = {
    TableName: tableName,
    Key: {
      LockName: lockName,
    },
    ConditionExpression: "attribute_exists(LockName)",
  }

  try {
    await dynamoDBClient.send(new DeleteCommand(params))
    return true
  } catch (err) {
    if (
      err instanceof Error &&
      err.name === "ConditionalCheckFailedException"
    ) {
      return false
    }
    throw err
  }
}

interface AWSError extends Error {
  code: string
}
