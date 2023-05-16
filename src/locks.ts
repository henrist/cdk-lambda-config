import { DocumentClient } from "aws-sdk/clients/dynamodb"
const dynamoDBClient: DocumentClient = new DocumentClient({
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
    await dynamoDBClient.put(params).promise()
    return true
  } catch (err) {
    if ((err as AWSError).code === "ConditionalCheckFailedException") {
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
    await dynamoDBClient.delete(params).promise()
    return true
  } catch (err: unknown) {
    if ((err as AWSError).code === "ConditionalCheckFailedException") {
      return false
    }
    throw err
  }
}

interface AWSError extends Error {
  code: string
}
