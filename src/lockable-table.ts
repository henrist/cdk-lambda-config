import { RemovalPolicy } from "aws-cdk-lib"
import {
  AttributeType,
  BillingMode,
  Table,
  TableProps,
} from "aws-cdk-lib/aws-dynamodb"
import { Construct } from "constructs"

export class LockableTable extends Table {
  private constructor(scope: Construct, id: string, props?: TableProps) {
    super(scope, id, {
      ...props,
      tableName: props?.tableName || "gi-lambda-at-edge-locks",
      partitionKey: { name: "LockName", type: AttributeType.STRING },
      billingMode: props?.billingMode || BillingMode.PAY_PER_REQUEST,
      removalPolicy: props?.removalPolicy || RemovalPolicy.DESTROY,
    })
  }

  static create(
    scope: Construct,
    id: string,
    props?: TableProps,
  ): LockableTable {
    return new LockableTable(scope, id, props)
  }
}
