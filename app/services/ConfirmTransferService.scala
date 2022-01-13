package services

import com.nimbusds.oauth2.sdk.token.BearerAccessToken
import configuration.GraphQLConfiguration
import controllers.FinalTransferConfirmationData
import graphql.codegen.AddFinalTransferConfirmation.{AddFinalTransferConfirmation => aftc}
import graphql.codegen.AddFinalJudgmentTransferConfirmation.{AddFinalJudgmentTransferConfirmation => afjtc}
import graphql.codegen.types.{AddFinalJudgmentTransferConfirmationInput, AddFinalTransferConfirmationInput}
import services.ApiErrorHandling.sendApiRequest
import uk.gov.nationalarchives.tdr.GraphQLClient

import java.util.UUID
import javax.inject.{Inject, Singleton}
import scala.concurrent.{ExecutionContext, Future}

@Singleton
class ConfirmTransferService @Inject()(val graphqlConfiguration: GraphQLConfiguration)(implicit val ec: ExecutionContext){
  private val addFinalTransferConfirmationClient: GraphQLClient[aftc.Data, aftc.Variables] =
    graphqlConfiguration.getClient[aftc.Data, aftc.Variables]() // Please ignore the Implicit-related error that IntelliJ displays, as it is incorrect.
  private val addFinalJudgmentTransferConfirmationClient: GraphQLClient[afjtc.Data, afjtc.Variables] =
    graphqlConfiguration.getClient[afjtc.Data, afjtc.Variables]()  // Please ignore the Implicit-related error that IntelliJ displays, as it is incorrect.

  def addFinalTransferConfirmation(consignmentId: UUID,
                                   token: BearerAccessToken,
                                   formData: FinalTransferConfirmationData): Future[Any] = {
    val addTransferAgreementInput: AddFinalTransferConfirmationInput = AddFinalTransferConfirmationInput(
      consignmentId,
      formData.openRecords,
      formData.transferLegalOwnership
    )

    val variables: aftc.Variables = aftc.Variables(addTransferAgreementInput)

    sendApiRequest(addFinalTransferConfirmationClient, aftc.document, token, variables).map(_.addFinalTransferConfirmation)
  }

  def addFinalJudgmentTransferConfirmation(consignmentId: UUID, token: BearerAccessToken): Future[Any] = {
    val addFinalJudgmentTransferConfirmationInput: AddFinalJudgmentTransferConfirmationInput =
      AddFinalJudgmentTransferConfirmationInput( consignmentId, legalCustodyTransferConfirmed = true)

    val variables: afjtc.Variables = afjtc.Variables(addFinalJudgmentTransferConfirmationInput)

    sendApiRequest(addFinalJudgmentTransferConfirmationClient, afjtc.document,
      token, variables).map(_.addFinalJudgmentTransferConfirmation)
  }
}