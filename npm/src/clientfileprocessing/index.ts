import { ClientFileMetadataUpload } from "../clientfilemetadataupload"
import { ClientFileExtractMetadata } from "../clientfileextractmetadata"
import {
  IFileMetadata,
  TdrFile,
  TProgressFunction
} from "@nationalarchives/file-information"
import { ITdrFile, S3Upload } from "../s3upload"

export class ClientFileProcessing {
  clientFileMetadataUpload: ClientFileMetadataUpload
  clientFileExtractMetadata: ClientFileExtractMetadata
  s3Upload: S3Upload

  constructor(
    clientFileMetadataUpload: ClientFileMetadataUpload,
    s3Upload: S3Upload
  ) {
    this.clientFileMetadataUpload = clientFileMetadataUpload
    this.clientFileExtractMetadata = new ClientFileExtractMetadata()
    this.s3Upload = s3Upload
  }

  async processClientFiles(
    consignmentId: string,
    files: TdrFile[],
    callback: TProgressFunction
  ): Promise<void> {
    try {
      const fileIds: string[] = await this.clientFileMetadataUpload.fileInformation(
        consignmentId,
        files.length
      )
      const metadata: IFileMetadata[] = await this.clientFileExtractMetadata.extract(
        files
      )
      const tdrFiles: ITdrFile[] = await this.clientFileMetadataUpload.clientFileMetadata(
        fileIds,
        metadata
      )
      this.s3Upload.uploadToS3(tdrFiles, callback)
    } catch (e) {
      throw Error("Processing client files failed: " + e.message)
    }
  }
}
