import { GraphqlClient } from "../graphql"

import {
  MarkUploadAsCompleted,
  MarkUploadAsCompletedMutation,
  MarkUploadAsCompletedMutationVariables
} from "@nationalarchives/tdr-generated-graphql"

import { FetchResult } from "apollo-boost"
import { FileUploadInfo } from "../upload/upload-form"
import { handleUploadError } from "../errorhandling"

export class UpdateConsignmentStatus {
  client: GraphqlClient

  constructor(client: GraphqlClient) {
    this.client = client
  }

  async markConsignmentStatusAsCompleted(
    uploadFilesInfo: FileUploadInfo
  ): Promise<void> {
    try {
      const variables: MarkUploadAsCompletedMutationVariables = {
        consignmentId: uploadFilesInfo.consignmentId
      }

      const result: FetchResult<MarkUploadAsCompletedMutation> =
        await this.client.mutation(MarkUploadAsCompleted, variables)

      if (!result.data || !result.data.markUploadAsCompleted || result.errors) {
        const errorMessage: string = result.errors
          ? result.errors.toString()
          : "no data"
        throw Error(errorMessage)
      }
    } catch (e) {
      handleUploadError(
        e,
        `Marking the Consignment Status as "Completed" failed`
      )
    }
  }
}
