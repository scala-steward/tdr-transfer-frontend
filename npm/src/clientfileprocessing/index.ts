import { ClientFileMetadataUpload } from "../clientfilemetadataupload"
import { ClientFileExtractMetadata } from "../clientfileextractmetadata"
import {
  IFileMetadata,
  TdrFile,
  TProgressFunction,
  IProgressInformation
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
    callback: TProgressFunction,
    stage: string
  ): Promise<void> {
    try {
      const fileIds: string[] = await this.clientFileMetadataUpload.saveFileInformation(
        consignmentId,
        files.length
      )
      const metadata: IFileMetadata[] = await this.clientFileExtractMetadata.extract(
        files,
        //Temporary function until s3 upload in place
        function(progressInformation: IProgressInformation) {
          console.log(
            "Percent of metadata extracted: " +
              progressInformation.percentageProcessed
          )
          const fileUpload: HTMLDivElement | null = document.querySelector(
            "#file-upload"
          )
          const progressBar: HTMLDivElement | null = document.querySelector(
            "#progress-bar"
          )
          const progressBarElement: HTMLDivElement | null = document.querySelector(
            ".progress-bar"
          )

          if (fileUpload && progressBar) {
            fileUpload.style.display = "none"
            progressBar.style.visibility = "visible"
          }

          if (
            progressBarElement &&
            progressInformation.percentageProcessed < 50
          ) {
            progressBarElement.setAttribute(
              "value",
              progressInformation.percentageProcessed.toString()
            )
          }
        }
      )
      const tdrFiles = await this.clientFileMetadataUpload.saveClientFileMetadata(
        fileIds,
        metadata
      )
      this.s3Upload.uploadToS3(consignmentId, tdrFiles, callback, stage)
    } catch (e) {
      throw Error("Processing client files failed: " + e.message)
    }
  }
}
