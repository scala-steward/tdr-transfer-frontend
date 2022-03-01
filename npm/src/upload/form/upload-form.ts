import { IFileWithPath } from "@nationalarchives/file-information"
import {
  getAllFiles,
  IDirectoryWithPath,
  IEntryWithPath,
  isFile
} from "./get-files-from-drag-event"
import { rejectUserItemSelection } from "./display-warning-message"
import {
  addFileSelectionSuccessMessage,
  addFolderSelectionSuccessMessage,
  displaySelectionSuccessMessage
} from "./update-and-display-success-message"

interface FileWithRelativePath extends File {
  webkitRelativePath: string
}

export interface FileUploadInfo {
  consignmentId: string
  parentFolder: string
}

export class UploadForm {
  isJudgmentUser: boolean
  formElement: HTMLFormElement
  itemRetriever: HTMLInputElement
  dropzone: HTMLElement
  selectedFiles: IEntryWithPath[]
  folderUploader: (
    files: IEntryWithPath[],
    uploadFilesInfo: FileUploadInfo
  ) => void

  constructor(
    isJudgmentUser: boolean,
    formElement: HTMLFormElement,
    itemRetriever: HTMLInputElement,
    dropzone: HTMLElement,
    folderUploader: (
      files: IEntryWithPath[],
      uploadFilesInfo: FileUploadInfo
    ) => void
  ) {
    this.isJudgmentUser = isJudgmentUser
    this.formElement = formElement
    this.itemRetriever = itemRetriever
    this.dropzone = dropzone
    this.selectedFiles = []
    this.folderUploader = folderUploader
  }

  consignmentId: () => string = () => {
    const value: string | null = this.formElement.getAttribute(
      "data-consignment-id"
    )

    if (!value) {
      throw Error("No consignment provided")
    }
    return value
  }

  addButtonHighlighter() {
    const itemRetrieverLabel: HTMLLabelElement = this.itemRetriever.labels![0]
    this.itemRetriever.addEventListener("focus", () => {
      itemRetrieverLabel.classList.add("drag-and-drop__button--highlight")
    })

    this.itemRetriever.addEventListener("blur", () => {
      itemRetrieverLabel.classList.remove("drag-and-drop__button--highlight")
    })
  }

  addDropzoneHighlighter() {
    this.dropzone.addEventListener("dragover", (ev) => {
      ev.preventDefault()
      this.dropzone.classList.add("drag-and-drop__dropzone--dragover")
    })

    this.dropzone.addEventListener("dragleave", () => {
      this.removeDragover()
    })
  }

  handleDroppedItems: (ev: DragEvent) => any = async (ev) => {
    ev.preventDefault()
    if (this.isJudgmentUser) {
      const fileList: FileList = ev.dataTransfer?.files!
      this.checkNumberOfObjectsDropped(
        fileList,
        "You are only allowed to drop one file."
      )
      const files: File[] = this.convertFileListToArray(fileList)
      const fileName: string = fileList.item(0)?.name!
      /* checkForCorrectJudgmentFileExtension must be called after the dropped item's type is checked
      (in convertFileListToArray), otherwise the extension error message will display when folder is dropped */
      this.checkForCorrectJudgmentFileExtension(fileName)
      this.selectedFiles = this.convertFilesToIfilesWithPath(files)
      addFileSelectionSuccessMessage(fileName)
    } else {
      const items: DataTransferItemList = ev.dataTransfer?.items!
      this.checkNumberOfObjectsDropped(
        items,
        "Only one folder is allowed to be selected"
      )
      const droppedItem: DataTransferItem | null = items[0]
      const webkitEntry = droppedItem.webkitGetAsEntry()
      this.checkIfDroppedItemIsFolder(webkitEntry)

      const filesAndDirectories: (IFileWithPath | IDirectoryWithPath)[] =
        await getAllFiles(webkitEntry, [])
      const files = filesAndDirectories.filter((f) =>
        isFile(f)
      ) as IFileWithPath[]
      this.checkIfFolderHasFiles(files)

      this.selectedFiles = filesAndDirectories
      addFolderSelectionSuccessMessage(
        webkitEntry.name,
        this.selectedFiles.filter((f) => isFile(f)).length
      )
    }
    displaySelectionSuccessMessage(this.successMessage, this.warningMessages)
    this.removeDragover()
  }

  handleSelectedItems: () => any = async () => {
    const form: HTMLFormElement | null = this.formElement
    this.selectedFiles = this.convertFilesToIfilesWithPath(form!.files!.files!)

    if (this.isJudgmentUser) {
      const fileWithPath = this.selectedFiles[0]
      if (isFile(fileWithPath)) {
        const fileName = fileWithPath.file.name
        this.checkForCorrectJudgmentFileExtension(fileName)
        addFileSelectionSuccessMessage(fileName)
      }
    } else {
      const parentFolder = this.getParentFolderName(this.selectedFiles)
      addFolderSelectionSuccessMessage(parentFolder, this.selectedFiles.length)
    }
    displaySelectionSuccessMessage(this.successMessage, this.warningMessages)
  }

  addFolderListener() {
    this.dropzone.addEventListener("drop", this.handleDroppedItems)
    this.itemRetriever.addEventListener("change", this.handleSelectedItems)
  }

  handleFormSubmission: (ev: Event) => void = async (ev: Event) => {
    ev.preventDefault()
    const itemSelected: IEntryWithPath = this.selectedFiles[0]

    if (itemSelected) {
      this.formElement.addEventListener("submit", (ev) => ev.preventDefault()) // adding new event listener, in order to prevent default submit button behaviour
      this.disableSubmitButtonAndDropzone()

      const parentFolder = this.getParentFolderName(this.selectedFiles)
      const uploadFilesInfo: FileUploadInfo = {
        consignmentId: this.consignmentId(),
        parentFolder: parentFolder
      }

      UploadForm.showUploadingRecordsPage()
      this.folderUploader(this.selectedFiles, uploadFilesInfo)
    } else {
      this.addSubmitListener() // Add submit listener back as we've set it to be removed after one form submission
      this.removeFilesAndDragOver()
      rejectUserItemSelection(
        this.warningMessages?.submissionWithoutSelectionMessage,
        this.warningMessages,
        this.successMessage,
        "A submission was made without an item being selected"
      )
    }
  }

  addSubmitListener() {
    this.formElement.addEventListener("submit", this.handleFormSubmission, {
      once: true
    })
  }

  readonly warningMessages: {
    [s: string]: HTMLElement | null
  } = {
    incorrectFileExtensionMessage: document.querySelector(
      "#incorrect-file-extension"
    ),
    incorrectItemSelectedMessage: document.querySelector(
      "#item-selection-failure"
    ),
    multipleItemSelectedMessage: document.querySelector(
      "#multiple-selection-failure"
    ),
    submissionWithoutSelectionMessage: document.querySelector(
      "#nothing-selected-submission-message"
    )
  }

  readonly successMessage: HTMLElement | null = document.querySelector(
    ".drag-and-drop__success"
  )

  private getParentFolderName(folder: IEntryWithPath[]) {
    const firstItem: IEntryWithPath = folder.filter((f) => isFile(f))[0]
    const relativePath: string = firstItem.path
    if (relativePath.includes("/")) {
      const splitPath: string[] = relativePath.split("/")
      return splitPath[1]
    } else {
      return relativePath
    }
  }

  private static showUploadingRecordsPage() {
    const fileUploadPage: HTMLDivElement | null =
      document.querySelector("#file-upload")
    const uploadProgressPage: HTMLDivElement | null =
      document.querySelector("#upload-progress")

    if (fileUploadPage && uploadProgressPage) {
      fileUploadPage.setAttribute("hidden", "true")
      uploadProgressPage.removeAttribute("hidden")
    }
  }

  private checkIfFolderHasFiles(files: File[] | IFileWithPath[]): void {
    if (files === null || files.length === 0) {
      this.removeFilesAndDragOver()
      rejectUserItemSelection(
        this.warningMessages?.incorrectItemSelectedMessage,
        this.warningMessages,
        this.successMessage,
        "The folder is empty"
      )
    }
  }

  private disableSubmitButtonAndDropzone() {
    const submitButton = document.querySelector("#start-upload-button")
    submitButton?.setAttribute("disabled", "true")

    const hiddenInputButton = document.querySelector("#file-selection")
    hiddenInputButton?.setAttribute("disabled", "true")

    this.dropzone.removeEventListener("drop", this.handleDroppedItems)
  }

  private convertFilesToIfilesWithPath(files: File[]): IFileWithPath[] {
    this.checkIfFolderHasFiles(files)

    return [...files].map((file) => ({
      file,
      path: (file as FileWithRelativePath).webkitRelativePath
    }))
  }

  private removeDragover(): void {
    this.dropzone.classList.remove("drag-and-drop__dropzone--dragover")
  }

  private checkNumberOfObjectsDropped(
    droppedObjects: DataTransferItemList | FileList,
    exceptionMessage: string
  ) {
    if (droppedObjects.length > 1) {
      this.removeFilesAndDragOver()
      rejectUserItemSelection(
        this.warningMessages?.multipleItemSelectedMessage,
        this.warningMessages,
        this.successMessage,
        exceptionMessage
      )
    }
  }

  private convertFileListToArray(fileList: FileList): File[] {
    const fileListIndexes = [...Array(fileList.length).keys()]
    return fileListIndexes.map((i) => {
      const file: File = fileList[i]
      if (!file.type) {
        this.removeFilesAndDragOver()
        rejectUserItemSelection(
          this.warningMessages?.incorrectItemSelectedMessage,
          this.warningMessages,
          this.successMessage,
          "Only files are allowed to be selected"
        )
      }

      return file
    })
  }

  private checkIfDroppedItemIsFolder(webkitEntry: any) {
    if (webkitEntry!.isFile) {
      this.removeFilesAndDragOver()
      rejectUserItemSelection(
        this.warningMessages?.incorrectItemSelectedMessage,
        this.warningMessages,
        this.successMessage,
        "Only folders are allowed to be selected"
      )
    }
  }

  private removeFilesAndDragOver() {
    this.selectedFiles = []
    this.removeDragover()
  }

  private checkForCorrectJudgmentFileExtension(fileName: string) {
    const judgmentFileExtensionsAllowList = [".docx"]

    if (fileName) {
      const indexOfLastDot = fileName.lastIndexOf(".")
      const fileExtension = fileName.slice(indexOfLastDot)
      if (!judgmentFileExtensionsAllowList.includes(fileExtension)) {
        this.removeFilesAndDragOver()
        rejectUserItemSelection(
          this.warningMessages?.incorrectFileExtensionMessage,
          this.warningMessages,
          this.successMessage,
          "Only MS Word docs are allowed to be selected"
        )
      }
    } else {
      throw "The file does not have a file name!"
    }
  }
}
