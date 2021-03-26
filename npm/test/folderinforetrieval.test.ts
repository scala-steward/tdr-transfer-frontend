import "@testing-library/jest-dom"
import { IFileWithPath } from "@nationalarchives/file-information"
import { ClientFileMetadataUpload } from "../src/clientfilemetadataupload"
import { GraphqlClient } from "../src/graphql"
import { FileUploader } from "../src/upload"
import { UploadForm, IReader, IWebkitEntry } from "../src/upload/upload-form"
import { mockKeycloakInstance } from "./utils"

const mockFileList: (file: File[]) => FileList = (file: File[]) => {
  return {
    length: file.length,
    item: (index: number) => {
      return file[index]
    }
  } as FileList
}

const mockDataTransferItemList: (
  entry: DataTransferItem,
  itemLength: number
) => DataTransferItemList = (entry: DataTransferItem, itemLength: number) => {
  return {
    item: jest.fn(),
    [Symbol.iterator]: jest.fn(),
    add: jest.fn(),
    length: itemLength,
    clear: jest.fn(),
    0: entry,
    remove: jest.fn()
  } as DataTransferItemList
}

class MockDom {
  constructor(numberOfFiles: number = 2) {
    if (numberOfFiles === 0) {
      this.entries = [[]]
    } else {
      this.entries = [[], Array(numberOfFiles).fill(this.fileEntry)]
    }
  }

  html = (document.body.innerHTML = `
      <div id="file-upload" class="govuk-grid-row">
          <div class="govuk-grid-column-two-thirds">
              <form id="file-upload-form" data-consignment-id="@consignmentId">
                  <div class="govuk-form-group">
                      <div class="drag-and-drop">
                          <div class="govuk-summary-list govuk-file-upload">
                              <div class="govuk-summary-list__row">
                                  <dd id="drag-and-drop-success" class="govuk-summary-list__value drag-and-drop__success" hidden tabindex="-1" role="alert" aria-describedby="successMessageText">
                                      <div>
                                          @greenTickMark()
                                          <p id="successMessageText" >The folder "<span id="folder-name"></span>" (containing <span id="folder-size"></span>) has been selected</p>
                                      </div>
                                  </dd>
                                  <dd id="drag-and-drop-failure" class="govuk-summary-list__value drag-and-drop__failure" hidden tabindex="-1" role="alert" aria-describedby="failureMessageText">
                                      @redWarningSign()
                                    <p id="failureMessageText">@Messages("upload.dragAndDropErrorMessage")</p>
                                  </dd>
                              </div>
                          </div>
                          <div>
                              <div class="govuk-form-group">
                                  <div class="drag-and-drop__dropzone">
                                      <input type="file" id="file-selection" name="files"
                                          class="govuk-file-upload drag-and-drop__input" webkitdirectory
                                          @* Specify an arbitrary type in the 'accept' attribute to work around a bug in
                                          Safari 14.0.1, which does not let the user browse for files if the 'accept'
                                          attribute is missing. The actual value of the attribute is ignored because
                                          'webkitdirectory' is specified. It just needs to be present to fix the Safari bug. *@
                                          accept="image/jpeg" aria-hidden="true"
                                      >
                                      <p class="govuk-body drag-and-drop__hint-text">@Messages("upload.dragAndDropHintText")</p>
                                      <label for="file-selection" class="govuk-button govuk-button--secondary drag-and-drop__button">
                                      @Messages("upload.chooseFolderLink")
                                      </label>
                                  </div>
                                  <p class="govuk-body">@Messages("upload.body.capturedMetadata")</p>
                                  <button class="govuk-button" type="submit" data-module="govuk-button" role="button">
                                      @Messages("upload.continueLink")
                                  </button>
                              </div>
                          </div>
                      </div>
                  </div>
              </form>
                      <!--        Form to redirect user once upload has completed. It sends consignmentId to record processing placeholder page -->
              @form(routes.FileChecksController.recordProcessingPage(consignmentId), Symbol("id") -> "upload-data-form") { }
          </div>
      </div>
      <div id="progress-bar" class="govuk-grid-row" hidden>`)

  dataTransferItemFields = {
    fullPath: "something", // add this to the fileEntry and directoryEntry object
    file: (success: any) => success(dummyFile),
    kind: "",
    type: "",
    getAsFile: jest.fn(),
    getAsString: jest.fn()
  }
  fileEntry: IWebkitEntry = {
    ...this.dataTransferItemFields,
    createReader: () => this.reader,
    type: "pdf", // overwrite default "type" value "" as files must have a non-empty value
    isFile: true,
    isDirectory: false,
    webkitGetAsEntry: () => ({
      isFile: true
    })
  }
  directoryEntry: IWebkitEntry = {
    ...this.dataTransferItemFields,
    createReader: () => this.reader,
    isFile: false,
    isDirectory: true,
    name: "Mock Folder",
    webkitGetAsEntry: () => this.fileEntry
  }

  dataTransferItem: DataTransferItem = {
    ...this.dataTransferItemFields,
    webkitGetAsEntry: () => this.directoryEntry
  }

  entries: IWebkitEntry[][] = [[], [this.fileEntry, this.fileEntry]]
  batchCount = this.entries.length
  reader: IReader = {
    readEntries: (cb) => {
      this.batchCount = this.batchCount - 1
      cb(this.entries[this.batchCount])
    }
  }

  mockFileList: (file: File[]) => FileList = (file: File[]) => {
    return {
      length: file.length,
      item: (index: number) => {
        return file[index]
      }
    } as FileList
  }

  mockDataTransferItemList: (
    entry: DataTransferItem,
    itemLength: number
  ) => DataTransferItemList = (entry: DataTransferItem, itemLength: number) => {
    return {
      item: jest.fn(),
      [Symbol.iterator]: jest.fn(),
      add: jest.fn(),
      length: itemLength,
      clear: jest.fn(),
      0: entry,
      remove: jest.fn()
    } as DataTransferItemList
  }

  addFilesToDragEvent = (
    folderToDrop: File[],
    itemsToDropEntryType: DataTransferItem
  ) => {
    return class MockDragEvent extends MouseEvent {
      constructor() {
        super("drag")
      }
      dataTransfer = {
        files: mockFileList(folderToDrop),
        dropEffect: "",
        effectAllowed: "",
        items: mockDataTransferItemList(
          itemsToDropEntryType,
          folderToDrop.length
        ),
        types: [],
        clearData: jest.fn(),
        getData: jest.fn(),
        setData: jest.fn(),
        setDragImage: jest.fn()
      }
    }
  }

  dropzone: HTMLElement | null = document.querySelector(
    ".drag-and-drop__dropzone"
  )
  uploadForm: HTMLFormElement | null = document.querySelector(
    "#file-upload-form"
  )
  folderRetriever: HTMLInputElement | null = document.querySelector(
    "#file-selection"
  )

  folderRetrievalSuccessMessage: HTMLElement | null = document.querySelector(
    ".drag-and-drop__success"
  )

  folderRetrievalFailureMessage: HTMLElement | null = document.querySelector(
    ".drag-and-drop__failure"
  )
  folderNameElement: HTMLElement | null = document.querySelector("#folder-name")
  folderSizeElement: HTMLElement | null = document.querySelector("#folder-size")

  form = new UploadForm(this.uploadForm!, this.folderRetriever!, this.dropzone!)
  fileUploader = this.setUpFileUploader()

  setUpFileUploader(): FileUploader {
    const client = new GraphqlClient(
      "https://example.com",
      mockKeycloakInstance
    )
    const uploadMetadata = new ClientFileMetadataUpload(client)
    return new FileUploader(
      uploadMetadata,
      "identityId",
      "test",
      mockGoToNextPage
    )
  }
  selectFolderViaButton: () => void = () => {
    triggerInputEvent(this.folderRetriever!, "change")
  }
}

const mockGoToNextPage = jest.fn()

const triggerInputEvent: (element: HTMLElement, domEvent: string) => void = (
  element: HTMLElement,
  domEvent: string
) => {
  const event = new CustomEvent(domEvent)
  element.dispatchEvent(event)
}

const dummyFolder = {
  lastModified: 2147483647,
  name: "Mock Folder",
  size: 0,
  type: ""
} as File

const dummyFile = {
  lastModified: 2147483647,
  name: "Mock File",
  size: 3008,
  type: "pdf"
} as File

const dummyIFileWithPath = {
  file: dummyFile,
  path: "Parent_Folder",
  webkitRelativePath: "Parent_Folder"
} as IFileWithPath

test("Input button updates the page with correct folder information if there are 1 or more files in folder", () => {
  const mockDom = new MockDom()
  mockDom.fileUploader.initialiseFormListeners()
  mockDom.uploadForm!.files = { files: [dummyIFileWithPath] }
  mockDom.selectFolderViaButton()

  expect(mockDom.folderRetrievalSuccessMessage!).not.toHaveAttribute(
    "hidden",
    "true"
  )
  expect(mockDom.folderRetrievalFailureMessage!).toHaveAttribute(
    "hidden",
    "true"
  )
  expect(mockDom.folderNameElement!.textContent).toStrictEqual("Parent_Folder")
  expect(mockDom.folderSizeElement!.textContent).toStrictEqual("1 file")
})

test("dropzone updates the page with correct folder information if there are 1 or more files in folder", async () => {
  const mockDom = new MockDom()
  const dragEventClass = mockDom.addFilesToDragEvent(
    [dummyFolder],
    mockDom.dataTransferItem
  )
  const dragEvent = new dragEventClass()
  await mockDom.form.handleDropppedItems(dragEvent)

  expect(mockDom.folderRetrievalSuccessMessage!).not.toHaveAttribute(
    "hidden",
    "true"
  )
  expect(mockDom.folderRetrievalFailureMessage!).toHaveAttribute(
    "hidden",
    "true"
  )
  expect(mockDom.folderNameElement!.textContent).toStrictEqual("Mock Folder")
  expect(mockDom.folderSizeElement!.textContent).toStrictEqual("2 files")
})

test("dropzone updates the page with an error if there are no files in folder", async () => {
  const mockDom = new MockDom(0)
  mockDom.batchCount = mockDom.entries.length
  const dragEventClass = mockDom.addFilesToDragEvent(
    [dummyFolder],
    mockDom.dataTransferItem
  )
  const dragEvent = new dragEventClass()
  await expect(mockDom.form.handleDropppedItems(dragEvent)).rejects.toEqual(
    Error("No files selected")
  )

  expect(mockDom.folderRetrievalSuccessMessage!).toHaveAttribute(
    "hidden",
    "true"
  )
  expect(mockDom.folderRetrievalFailureMessage!).not.toHaveAttribute(
    "hidden",
    "true"
  )
  expect(mockDom.folderNameElement!.textContent).toStrictEqual("")
  expect(mockDom.folderSizeElement!.textContent).toStrictEqual("")
})

test("dropzone updates the page with correct folder information if there is a nested folder of files in the main folder", async () => {
  const mockDom = new MockDom()

  const dataTransferItemWithNestedDirectory: DataTransferItem = {
    ...mockDom.dataTransferItemFields,
    webkitGetAsEntry: () => nestedDirectoryEntry
  }

  const nestedDirectoryEntry: IWebkitEntry = {
    ...mockDom.dataTransferItemFields,
    createReader: () => nestedDirectoryEntryReader,
    isFile: false,
    isDirectory: true,
    name: "Mock Folder",
    webkitGetAsEntry: () => mockDom.fileEntry
  }

  const mockNestedEntries: IWebkitEntry[][] = [[], [mockDom.directoryEntry]] // have to create an entry here to act as top-level directory
  let nestedDirectoryBatchCount = mockDom.entries.length
  const nestedDirectoryEntryReader: IReader = {
    readEntries: (cb) => {
      nestedDirectoryBatchCount = nestedDirectoryBatchCount - 1
      cb(mockNestedEntries[nestedDirectoryBatchCount])
    }
  }

  const dragEventClass = mockDom.addFilesToDragEvent(
    [dummyFolder],
    dataTransferItemWithNestedDirectory
  )
  const dragEvent = new dragEventClass()
  await mockDom.form.handleDropppedItems(dragEvent)

  expect(mockDom.folderRetrievalSuccessMessage!).not.toHaveAttribute(
    "hidden",
    "true"
  )
  expect(mockDom.folderRetrievalFailureMessage!).toHaveAttribute(
    "hidden",
    "true"
  )
  expect(mockDom.folderNameElement!.textContent).toStrictEqual("Mock Folder")
  expect(mockDom.folderSizeElement!.textContent).toStrictEqual("2 files")
})

test("dropzone updates the page with an error if more than 1 item (2 folders) has been dropped", async () => {
  const mockDom = new MockDom()
  const dragEventClass = mockDom.addFilesToDragEvent(
    [dummyFolder, dummyFolder],
    mockDom.directoryEntry
  )
  const dragEvent = new dragEventClass()
  await expect(mockDom.form.handleDropppedItems(dragEvent)).rejects.toEqual(
    Error("No files selected")
  )

  expect(mockDom.folderRetrievalSuccessMessage!).toHaveAttribute(
    "hidden",
    "true"
  )
  expect(mockDom.folderRetrievalFailureMessage!).not.toHaveAttribute(
    "hidden",
    "true"
  )
  expect(mockDom.folderNameElement!.textContent).toStrictEqual("")
  expect(mockDom.folderSizeElement!.textContent).toStrictEqual("")
})

test("dropzone updates the page with an error if more than 1 item (folder and file) has been dropped", async () => {
  const mockDom = new MockDom()
  const dragEventClass = mockDom.addFilesToDragEvent(
    [dummyFolder, dummyFile],
    mockDom.directoryEntry
  )
  const dragEvent = new dragEventClass()
  await expect(mockDom.form.handleDropppedItems(dragEvent)).rejects.toEqual(
    Error("No files selected")
  )

  expect(mockDom.folderRetrievalSuccessMessage!).toHaveAttribute(
    "hidden",
    "true"
  )
  expect(mockDom.folderRetrievalFailureMessage!).not.toHaveAttribute(
    "hidden",
    "true"
  )
  expect(mockDom.folderNameElement!.textContent).toStrictEqual("")
  expect(mockDom.folderSizeElement!.textContent).toStrictEqual("")
})

test("dropzone updates the page with an error if 1 non-folder has been dropped", async () => {
  const mockDom = new MockDom()
  const dragEventClass = mockDom.addFilesToDragEvent(
    [dummyFile],
    mockDom.fileEntry
  )
  const dragEvent = new dragEventClass()
  await expect(mockDom.form.handleDropppedItems(dragEvent)).rejects.toEqual(
    Error("No files selected")
  )

  expect(mockDom.folderRetrievalSuccessMessage!).toHaveAttribute(
    "hidden",
    "true"
  )
  expect(mockDom.folderRetrievalFailureMessage!).not.toHaveAttribute(
    "hidden",
    "true"
  )
  expect(mockDom.folderNameElement!.textContent).toStrictEqual("")
  expect(mockDom.folderSizeElement!.textContent).toStrictEqual("")
})
