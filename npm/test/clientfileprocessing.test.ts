import { ClientFileMetadataUpload } from "../src/clientfilemetadataupload"
import { GraphqlClient } from "../src/graphql"
import { ClientFileProcessing } from "../src/clientfileprocessing"
import {
  IFileMetadata,
  TdrFile,
  TProgressFunction
} from "@nationalarchives/file-information"
import { ClientFileExtractMetadata } from "../src/clientfileextractmetadata"
import { S3Upload, ITdrFile } from "../src/s3upload"
import { ManagedUpload } from "aws-sdk/clients/s3"
import { mockKeycloakInstance } from "./utils"

jest.mock("../src/clientfilemetadataupload")
jest.mock("../src/clientfileextractmetadata")
jest.mock("../src/s3upload")

beforeEach(() => jest.resetModules())

class S3UploadMock extends S3Upload {
  uploadToS3: (
    consignmentId: string,
    files: ITdrFile[],
    callback: TProgressFunction,
    stage: string,
    chunkSize?: number
  ) => Promise<ManagedUpload.SendData[]> = jest.fn()
}

class ClientFileUploadSuccess {
  saveFileInformation: (
    consignmentId: string,
    numberOfFiles: number
  ) => Promise<string[]> = async (
    consignmentId: string,
    numberOfFiles: number
  ) => {
    return Promise.resolve(["1", "2"])
  }
  saveClientFileMetadata: (
    files: File[],
    fileIds: string[]
  ) => Promise<void> = async (files: File[], fileIds: string[]) => {
    return Promise.resolve()
  }
}

class ClientFileExtractMetadataSuccess {
  extract: (files: TdrFile[]) => Promise<IFileMetadata[]> = async (
    files: TdrFile[]
  ) => {
    return Promise.resolve([])
  }
}

class ClientFileUploadFileInformationFailure {
  saveFileInformation: (
    consignmentId: string,
    numberOfFiles: number
  ) => Promise<string[]> = async (
    consignmentId: string,
    numberOfFiles: number
  ) => {
    return Promise.reject(Error("upload client file information error"))
  }
  saveClientFileMetadata: (
    files: File[],
    fileIds: string[]
  ) => Promise<void> = async (files: File[], fileIds: string[]) => {
    return Promise.resolve()
  }
}

class ClientFileUploadMetadataFailure {
  saveFileInformation: (
    consignmentId: string,
    numberOfFiles: number
  ) => Promise<string[]> = async (
    consignmentId: string,
    numberOfFiles: number
  ) => {
    return Promise.resolve(["1", "2"])
  }
  saveClientFileMetadata: (
    files: File[],
    fileIds: string[]
  ) => Promise<void> = async (files: File[], fileIds: string[]) => {
    return Promise.reject(Error("upload client file metadata error"))
  }
}

class MockClientFileProcessing {
  updateProgressBar(element: HTMLDivElement | null, progress: number): void {
    return
  }
}

class ClientFileExtractMetadataFailure {
  extract: (files: TdrFile[]) => Promise<IFileMetadata[]> = async (
    files: TdrFile[]
  ) => {
    return Promise.reject(Error("client file metadata extraction error"))
  }
}

const mockMetadataUploadSuccess: () => void = () => {
  const mock = ClientFileMetadataUpload as jest.Mock
  mock.mockImplementation(() => {
    return new ClientFileUploadSuccess()
  })
}

const mockMetadataExtractSuccess: () => void = () => {
  const mock = ClientFileExtractMetadata as jest.Mock
  mock.mockImplementation(() => {
    return new ClientFileExtractMetadataSuccess()
  })
}

const mockUploadFileInformationFailure: () => void = () => {
  const mock = ClientFileMetadataUpload as jest.Mock
  mock.mockImplementation(() => {
    return new ClientFileUploadFileInformationFailure()
  })
}

const mockUploadMetadataFailure: () => void = () => {
  const mock = ClientFileMetadataUpload as jest.Mock
  mock.mockImplementation(() => {
    return new ClientFileUploadMetadataFailure()
  })
}

const mockMetadataExtractFailure: () => void = () => {
  const mock = ClientFileExtractMetadata as jest.Mock
  mock.mockImplementation(() => {
    return new ClientFileExtractMetadataFailure()
  })
}

function setupUploadPageHTML() {
  document.body.innerHTML =
    '<div id="file-upload" class="govuk-grid-row"></div>' +
    '<div id="progress-bar" class="govuk-grid-row hide">'
}

function checkExpectedPageState() {
  setupUploadPageHTML()

  const fileUpload: HTMLDivElement | null = document.querySelector(
    "#file-upload"
  )
  const progressBar: HTMLDivElement | null = document.querySelector(
    "#progress-bar"
  )

  expect(progressBar && progressBar.classList.toString()).toEqual(
    "govuk-grid-row hide"
  )

  expect(fileUpload && fileUpload.classList.toString()).toEqual(
    "govuk-grid-row"
  )
}

test("client file metadata successfully uploaded", async () => {
  checkExpectedPageState()

  mockMetadataExtractSuccess()
  mockMetadataUploadSuccess()

  const client = new GraphqlClient("test", mockKeycloakInstance)
  const metadataUpload: ClientFileMetadataUpload = new ClientFileMetadataUpload(
    client
  )
  const fileProcessing = new ClientFileProcessing(
    metadataUpload,
    new S3UploadMock("")
  )
  await expect(
    fileProcessing.processClientFiles("1", [], jest.fn(), "")
  ).resolves.not.toThrow()
})

test("file successfully uploaded to s3", async () => {
  mockMetadataExtractSuccess()
  mockMetadataUploadSuccess()

  const client = new GraphqlClient("test", mockKeycloakInstance)
  const metadataUpload: ClientFileMetadataUpload = new ClientFileMetadataUpload(
    client
  )
  const s3UploadMock = new S3UploadMock("")
  const fileProcessing = new ClientFileProcessing(metadataUpload, s3UploadMock)
  await expect(
    fileProcessing.processClientFiles("1", [], jest.fn(), "")
  ).resolves.not.toThrow()

  expect(s3UploadMock.uploadToS3).toHaveBeenCalledTimes(1)
})

test("Error thrown if processing files fails", async () => {
  mockMetadataExtractSuccess()
  mockUploadFileInformationFailure()

  const client = new GraphqlClient("test", mockKeycloakInstance)
  const metadataUpload: ClientFileMetadataUpload = new ClientFileMetadataUpload(
    client
  )
  const fileProcessing = new ClientFileProcessing(
    metadataUpload,
    new S3UploadMock("")
  )

  await expect(
    fileProcessing.processClientFiles("1", [], jest.fn(), "")
  ).rejects.toStrictEqual(
    Error(
      "Processing client files failed: upload client file information error"
    )
  )
})

test("Error thrown if processing file metadata fails", async () => {
  mockMetadataExtractSuccess()
  mockUploadMetadataFailure()

  const client = new GraphqlClient("test", mockKeycloakInstance)
  const metadataUpload: ClientFileMetadataUpload = new ClientFileMetadataUpload(
    client
  )
  const fileProcessing = new ClientFileProcessing(
    metadataUpload,
    new S3UploadMock("")
  )

  await expect(
    fileProcessing.processClientFiles("1", [], jest.fn(), "")
  ).rejects.toStrictEqual(
    Error("Processing client files failed: upload client file metadata error")
  )
})

test("Error thrown if extracting file metadata fails", async () => {
  mockMetadataExtractFailure()
  mockMetadataUploadSuccess()

  const client = new GraphqlClient("test", mockKeycloakInstance)
  const metadataUpload: ClientFileMetadataUpload = new ClientFileMetadataUpload(
    client
  )
  const fileProcessing = new ClientFileProcessing(
    metadataUpload,
    new S3UploadMock("")
  )

  await expect(
    fileProcessing.processClientFiles("1", [], jest.fn(), "")
  ).rejects.toStrictEqual(
    Error(
      "Processing client files failed: client file metadata extraction error"
    )
  )
})
