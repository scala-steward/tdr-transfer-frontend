import {
  GetFileCheckProgressQueryVariables,
  GetFileCheckProgressQuery
} from "@nationalarchives/tdr-generated-graphql"
import { FetchResult } from "apollo-boost"
import { GraphqlClient } from "../graphql"
import { getGraphqlDocuments } from "../index"

export interface IFileCheckProcessed {
  antivirusProcessed: number
  checksumProcessed: number
  ffidProcessed: number
  totalFiles: number
}

export const getConsignmentId: () => string = () => {
  const consignmentIdElement: HTMLInputElement | null =
    document.querySelector("#consignmentId")
  if (!consignmentIdElement) {
    throw Error("No consignment provided")
  }
  return consignmentIdElement.value
}

export const getConsignmentData: (
  client: GraphqlClient,
  callback: (fileCheckProcessed: IFileCheckProcessed | null) => void
) => void = (client, callback) => {
  const consignmentId = getConsignmentId()
  const variables: GetFileCheckProgressQueryVariables = {
    consignmentId
  }

  getGraphqlDocuments().then((documents) => {
    const resultPromise: Promise<FetchResult<GetFileCheckProgressQuery>> =
      client.mutation(documents.GetFileCheckProgress, variables)

    resultPromise
      .then((result) => {
        if (!result.data || result.errors) {
          const errorMessage: string = result.errors
            ? result.errors.toString()
            : "no data"
          throw Error("Add files failed: " + errorMessage)
        } else {
          const getConsignment = result.data.getConsignment
          if (getConsignment) {
            const fileChecks = getConsignment.fileChecks
            const totalFiles = getConsignment.totalFiles
            const antivirusProcessed =
              fileChecks.antivirusProgress.filesProcessed
            const checksumProcessed = fileChecks.checksumProgress.filesProcessed
            const ffidProcessed = fileChecks.ffidProgress.filesProcessed
            callback({
              antivirusProcessed,
              checksumProcessed,
              ffidProcessed,
              totalFiles
            })
          } else {
            console.log(
              `No progress metadata found for consignment ${consignmentId}`
            )
            callback(null)
          }
        }
      })
      .catch(() => callback(null))
  })
}
