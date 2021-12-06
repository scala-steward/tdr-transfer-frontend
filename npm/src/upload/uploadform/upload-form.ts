import { IFileWithPath } from "@nationalarchives/file-information"
import { getAllFiles } from "./get-files-from-drag-event"
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
  folderRetriever: HTMLInputElement
  dropzone: HTMLElement
  selectedFiles: IFileWithPath[]
  folderUploader: (
    files: IFileWithPath[],
    uploadFilesInfo: FileUploadInfo
  ) => void

  constructor(
    isJudgmentUser: boolean,
    formElement: HTMLFormElement,
    folderRetriever: HTMLInputElement,
    dropzone: HTMLElement,
    folderUploader: (
      files: IFileWithPath[],
      uploadFilesInfo: FileUploadInfo
    ) => void
  ) {
    this.isJudgmentUser = isJudgmentUser
    this.formElement = formElement
    this.folderRetriever = folderRetriever
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
    this.folderRetriever.addEventListener("focus", () => {
      const folderRetrieverLabel: HTMLLabelElement =
        this.folderRetriever.labels![0]
      folderRetrieverLabel.classList.add("drag-and-drop__button--highlight")
    })

    this.folderRetriever.addEventListener("blur", () => {
      const folderRetrieverLabel: HTMLLabelElement =
        this.folderRetriever.labels![0]
      folderRetrieverLabel.classList.remove("drag-and-drop__button--highlight")
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
      const fileName: string = fileList.item(0)?.name!
      this.checkForCorrectJudgmentFileExtension(fileName)
      const files: File[] = this.convertFileListToArray(fileList)
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

      const files: IFileWithPath[] = await getAllFiles(webkitEntry, [])
      this.checkIfFolderHasFiles(files)

      this.selectedFiles = files
      addFolderSelectionSuccessMessage(
        webkitEntry.name,
        this.selectedFiles.length
      )
    }
    displaySelectionSuccessMessage(this.successMessage, this.warningMessages)
    this.removeDragover()
  }

  handleSelectedItems: () => any = async () => {
    const form: HTMLFormElement | null = this.formElement
    this.selectedFiles = this.convertFilesToIfilesWithPath(form!.files!.files!)

    if (this.isJudgmentUser) {
      const fileName = this.selectedFiles[0].file.name
      this.checkForCorrectJudgmentFileExtension(fileName)
      addFileSelectionSuccessMessage(fileName)
    } else {
      const parentFolder = this.getParentFolderName(this.selectedFiles)
      addFolderSelectionSuccessMessage(parentFolder, this.selectedFiles.length)
    }
    displaySelectionSuccessMessage(this.successMessage, this.warningMessages)
  }

  addFolderListener() {
    this.dropzone.addEventListener("drop", this.handleDroppedItems)
    this.folderRetriever.addEventListener("change", this.handleSelectedItems)
  }

  handleFormSubmission: (ev: Event) => void = (ev: Event) => {
    ev.preventDefault()
    const itemSelected: IFileWithPath | undefined = this.selectedFiles[0]

    if (itemSelected) {
      this.formElement.addEventListener("submit", (ev) => ev.preventDefault()) // adding new event listener, in order to prevent default submit button behaviour
      this.disableSubmitButtonAndDropzone()

      const parentFolder = this.getParentFolderName(this.selectedFiles)
      const uploadFilesInfo: FileUploadInfo = {
        consignmentId: this.consignmentId(),
        parentFolder: parentFolder
      }

      this.showUploadingRecordsPage()
      this.folderUploader(this.selectedFiles, uploadFilesInfo)
    } else {
      this.successMessage?.setAttribute("hidden", "true")
      this.warningMessages.incorrectItemSelectedMessage?.setAttribute(
        "hidden",
        "true"
      )
      const incorrectFileExtensionElement =
        this.warningMessages.incorrectFileExtensionMessage
      if (incorrectFileExtensionElement)
        incorrectFileExtensionElement.setAttribute("hidden", "true")

      this.warningMessages.submissionWithoutSelectionMessage?.removeAttribute(
        "hidden"
      )

      this.warningMessages.submissionWithoutSelectionMessage?.focus()
      this.addSubmitListener() // Readd submit listener as we've set it to be removed after one form submission
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
    submissionWithoutSelectionMessage: document.querySelector(
      "#nothing-selected-submission-message"
    )
  }

  readonly successMessage: HTMLElement | null = document.querySelector(
    ".drag-and-drop__success"
  )

  private getParentFolderName(folder: IFileWithPath[]) {
    const firstItem: FileWithRelativePath = folder[0]
      .file as FileWithRelativePath
    const relativePath: string = firstItem.webkitRelativePath
    const splitPath: string[] = relativePath.split("/")
    const parentFolder: string = splitPath[0]
    return parentFolder
  }

  private showUploadingRecordsPage() {
    const fileUpload: HTMLDivElement | null =
      document.querySelector("#file-upload")
    const uploadProgressPage: HTMLDivElement | null =
      document.querySelector("#upload-progress")

    if (fileUpload && uploadProgressPage) {
      fileUpload.setAttribute("hidden", "true")
      uploadProgressPage.removeAttribute("hidden")
    }
  }

  private checkIfFolderHasFiles(files: File[] | IFileWithPath[]): void {
    if (files === null || files.length === 0) {
      this.removeFilesAndDropShadow()
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
      this.removeFilesAndDropShadow()
      rejectUserItemSelection(
        this.warningMessages?.incorrectItemSelectedMessage,
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
        this.removeFilesAndDropShadow()
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
      this.removeFilesAndDropShadow()
      rejectUserItemSelection(
        this.warningMessages?.incorrectItemSelectedMessage,
        this.warningMessages,
        this.successMessage,
        "Only folders are allowed to be selected"
      )
    }
  }

  private removeFilesAndDropShadow() {
    this.selectedFiles = []
    this.removeDragover()
  }

  private checkForCorrectJudgmentFileExtension(fileName: string) {
    const acceptableJudgmentFileExtensions = [
      ".doc",
      ".docm",
      ".docx",
      ".dot",
      ".dotm",
      ".dotx"
    ]

    if (fileName) {
      const indexOfLastDot = fileName.lastIndexOf(".")
      const fileExtension = fileName.slice(indexOfLastDot)
      if (!acceptableJudgmentFileExtensions.includes(fileExtension)) {
        this.removeFilesAndDropShadow()
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
