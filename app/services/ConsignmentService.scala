package services

import java.util.UUID

import com.nimbusds.oauth2.sdk.token.BearerAccessToken
import configuration.GraphQLConfiguration
import graphql.codegen.AddConsignment.addConsignment
import graphql.codegen.GetConsignment.getConsignment
import graphql.codegen.types.AddConsignmentInput
import graphql.codegen.{AddConsignment, GetConsignment}
import javax.inject.{Inject, Singleton}
import services.ApiErrorHandling._

import scala.concurrent.{ExecutionContext, Future}

@Singleton
class ConsignmentService @Inject()(val graphqlConfiguration: GraphQLConfiguration)
                                  (implicit val ec: ExecutionContext)  {

  private val getConsignmentClient = graphqlConfiguration.getClient[getConsignment.Data, getConsignment.Variables]()
  private val addConsignmentClient = graphqlConfiguration.getClient[addConsignment.Data, addConsignment.Variables]()

  def consignmentExists(consignmentId: UUID,
                        token: BearerAccessToken): Future[Boolean] = {
    val variables: getConsignment.Variables = new GetConsignment.getConsignment.Variables(consignmentId)

    sendApiRequest(getConsignmentClient, getConsignment.document, token, variables)
      .map(data => data.getConsignment.isDefined)
  }

  def createConsignment(seriesId: UUID, token: BearerAccessToken): Future[addConsignment.AddConsignment] = {
    val addConsignmentInput: AddConsignmentInput = AddConsignmentInput(seriesId)
    val variables: addConsignment.Variables = AddConsignment.addConsignment.Variables(addConsignmentInput)

    sendApiRequest(addConsignmentClient, addConsignment.document, token, variables)
      .map(data => data.addConsignment)
  }
}