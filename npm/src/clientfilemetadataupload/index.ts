import {GraphqlClient} from "../graphql"

import {IFileMetadata} from "@nationalarchives/file-information"

import {
  AddFilesAndMetadata,
  AddFilesAndMetadataMutation,
  AddFilesAndMetadataMutationVariables,
  ClientSideMetadataInput,
  StartUpload,
  StartUploadMutation,
  StartUploadMutationVariables
} from "@nationalarchives/tdr-generated-graphql"

import {ITdrFile} from "../s3upload"
import {FileUploadInfo} from "../upload/form/upload-form"
import {FutureInstance, map, parallel} from "fluture";

declare var METADATA_UPLOAD_BATCH_SIZE: string

export class ClientFileMetadataUpload {
  client: GraphqlClient

  constructor(client: GraphqlClient) {
    this.client = client
  }

  startUpload(uploadFilesInfo: FileUploadInfo): FutureInstance<unknown, void> {
    const variables: StartUploadMutationVariables = {
      input: uploadFilesInfo
    }

    return this.client.mutation<StartUploadMutation, StartUploadMutationVariables>(
      StartUpload,
      variables
    ).pipe(map(result => {
      if (!result.data || result.errors) {
        const errorMessage: string = result.errors
          ? result.errors.toString()
          : "no data"
        throw Error(`Start upload failed: ${errorMessage}`)
      }
    }))
  }

  saveClientFileMetadata(
    consignmentId: string,
    allFileMetadata: IFileMetadata[]
  ): FutureInstance<unknown, ITdrFile[]> {
    const {metadataInputs, matchFileMap} =
      this.createMetadataInputsAndFileMap(allFileMetadata)

    const metadataBatches: ClientSideMetadataInput[][] =
      this.createMetadataInputBatches(metadataInputs)

    return parallel(1)(metadataBatches.map(metadataInput => {
      const variables: AddFilesAndMetadataMutationVariables = {
        input: {
          consignmentId,
          metadataInput
        }
      }
      return this.client.mutation<AddFilesAndMetadataMutation, AddFilesAndMetadataMutationVariables>(AddFilesAndMetadata, variables)
        .pipe(map(result => {
          if (result.errors) {
            throw Error(
              `Add client file metadata failed: ${result.errors.toString()}`
            )
          }
          if (result.data) {
            return result.data.addFilesAndMetadata.map((f) => {
              const fileId: string = f.fileId
              const file: File | undefined = matchFileMap.get(f.matchId)
              if (!file) {
                throw Error(`Invalid match id ${f.matchId} for file ${fileId}`)
              }
              return { fileId, file }
            })
          } else {
            throw Error(
              `No data found in response for consignment ${consignmentId}`
            )
          }
        }))
    })).pipe(map(files => files.flat()))
  }

  createMetadataInputBatches(metadataInputs: ClientSideMetadataInput[]) {
    const batches: ClientSideMetadataInput[][] = []
    // METADATA_UPLOAD_BATCH_SIZE comes in as a string despite typescript thinking it's a number.
    // This means that on the first pass of the loop, index is set to "0250" and then exits.
    // Setting the type to string and parsing the number sets the batches correctly.
    const batchSize = parseInt(METADATA_UPLOAD_BATCH_SIZE, 10)

    for (let index = 0; index < metadataInputs.length; index += batchSize) {
      batches.push(metadataInputs.slice(index, index + batchSize))
    }

    return batches
  }

  createMetadataInputsAndFileMap(allFileMetadata: IFileMetadata[]): {
    metadataInputs: ClientSideMetadataInput[]
    matchFileMap: Map<number, File>
  } {
    return allFileMetadata.reduce(
      (result, metadata: IFileMetadata, matchId) => {
        const {checksum, path, lastModified, file, size} = metadata
        result.matchFileMap.set(matchId, file)

        //Files uploaded with 'drag and files' have '/'  prepended, those uploaded with 'browse' don't
        //Ensure file paths stored in database are consistent
        const validatedPath = path.startsWith("/") ? path.substring(1) : path
        const metadataInput: ClientSideMetadataInput = {
          originalPath: validatedPath ? validatedPath : file.name,
          checksum,
          lastModified: lastModified.getTime(),
          fileSize: size,
          matchId
        }
        result.metadataInputs.push(metadataInput)

        return result
      },
      {
        metadataInputs: <ClientSideMetadataInput[]>[],
        matchFileMap: new Map<number, File>()
      }
    )
  }
}
