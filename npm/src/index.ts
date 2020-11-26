import { configureAws } from "./aws-config"
import { GraphqlClient } from "./graphql"
import { getKeycloakInstance, authenticateAndGetIdentityId } from "./auth"
import { FileUploader } from "./upload"
import { ClientFileMetadataUpload } from "./clientfilemetadataupload"
import { goToNextPage } from "./upload/next-page-redirect"
import { FileChecks } from "./filechecks"

window.onload = function() {
  renderModules()
}

export interface IFrontEndInfo {
  apiUrl: string
  identityProviderName: string
  identityPoolId: string
  stage: string
  region: string
  cognitoEndpointOverride?: string
  s3EndpointOverride?: string
}

const getFrontEndInfo: () => IFrontEndInfo = () => {
  const identityPoolElement: HTMLInputElement | null = document.querySelector(
    ".identity-pool-id"
  )
  const apiUrlElement: HTMLInputElement | null = document.querySelector(
    ".api-url"
  )
  const identityProviderNameElement: HTMLInputElement | null = document.querySelector(
    ".identity-provider-name"
  )
  const stageElement: HTMLInputElement | null = document.querySelector(".stage")
  const regionElement: HTMLInputElement | null = document.querySelector(
    ".region"
  )
  const cognitoEndpointOverrideElement: HTMLInputElement | null = document.querySelector(
    ".cognito-endpoint-override"
  )
  const s3EndpointOverrideElement: HTMLInputElement | null = document.querySelector(
    ".s3-endpoint-override"
  )

  if (
    apiUrlElement &&
    identityProviderNameElement &&
    identityPoolElement &&
    stageElement &&
    regionElement
  ) {
    return {
      apiUrl: apiUrlElement.value,
      identityProviderName: identityProviderNameElement.value,
      identityPoolId: identityPoolElement.value,
      stage: stageElement.value,
      region: regionElement.value,
      cognitoEndpointOverride: cognitoEndpointOverrideElement?.value,
      s3EndpointOverride: s3EndpointOverrideElement?.value
    }
  } else {
    throw "The front end information is missing"
  }
}

export const renderModules = () => {
  const uploadContainer: HTMLDivElement | null = document.querySelector(
    ".govuk-file-upload"
  )
  const fileChecksContainer: HTMLDivElement | null = document.querySelector(
    ".file-check-progress"
  )
  if (uploadContainer) {
    const frontEndInfo = getFrontEndInfo()

    configureAws(frontEndInfo)

    getKeycloakInstance().then(keycloak => {
      const graphqlClient = new GraphqlClient(frontEndInfo.apiUrl, keycloak)
      authenticateAndGetIdentityId(keycloak, frontEndInfo).then(identityId => {
        const clientFileProcessing = new ClientFileMetadataUpload(graphqlClient)
        new FileUploader(
          clientFileProcessing,
          identityId,
          frontEndInfo.stage,
          goToNextPage
        ).initialiseFormListeners()
      })
    })
  }
  if (fileChecksContainer) {
    const frontEndInfo = getFrontEndInfo()
    getKeycloakInstance().then(keycloak => {
      const graphqlClient = new GraphqlClient(frontEndInfo.apiUrl, keycloak)
      new FileChecks(graphqlClient).updateFileCheckProgress()
    })
  }
}
