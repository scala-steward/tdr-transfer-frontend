package controllers

import java.util.UUID

import auth.TokenSecurity
import configuration.{GraphQLConfiguration, KeycloakConfiguration}
import graphql.codegen.AddConsignment
import graphql.codegen.AddConsignment.addConsignment
import graphql.codegen.GetSeries.getSeries
import graphql.codegen.types.AddConsignmentInput
import javax.inject.{Inject, Singleton}
import org.pac4j.play.scala.SecurityComponents
import play.api.data.Form
import play.api.data.Forms._
import play.api.i18n.I18nSupport
import play.api.mvc._

import scala.concurrent.{ExecutionContext, Future}

@Singleton
class SeriesDetailsController @Inject()(val controllerComponents: SecurityComponents,
                                        val graphqlConfiguration: GraphQLConfiguration,
                                        val keycloakConfiguration: KeycloakConfiguration
                                        )(implicit val ec: ExecutionContext) extends TokenSecurity with I18nSupport {

  private val getSeriesClient = graphqlConfiguration.getClient[getSeries.Data, getSeries.Variables]()
  private val addConsignmentClient = graphqlConfiguration.getClient[addConsignment.Data, addConsignment.Variables]()

  val selectedSeriesForm = Form(
    mapping(
      "series" -> nonEmptyText
    )(SelectedSeriesData.apply)(SelectedSeriesData.unapply)
  )

  private def getSeriesDetails(request: Request[AnyContent], status: Status, form: Form[SelectedSeriesData])(implicit requestHeader: RequestHeader) = {
    val userTransferringBody: String = request.token.transferringBody
      .getOrElse(throw new RuntimeException(s"Transferring body missing from token for user ${request.token.userId}"))
    val variables: getSeries.Variables = new getSeries.Variables(userTransferringBody)

    getSeriesClient.getResult(request.token.bearerAccessToken, getSeries.document, Some(variables)).map(data => {
      if (data.data.isDefined) {
        val seriesData: Seq[(String, String)] = data.data.get.getSeries.map(s => (s.seriesid.toString, s.code.getOrElse("")))
        status(views.html.seriesDetails(seriesData, form))
      } else {
        BadRequest(views.html.error(data.errors.map(e => e.message).mkString))
      }
    })
  }

  def seriesDetails(): Action[AnyContent] = secureAction.async { implicit request: Request[AnyContent] =>
    getSeriesDetails(request, Ok, selectedSeriesForm)
  }

  def seriesSubmit(): Action[AnyContent] =  secureAction.async { implicit request: Request[AnyContent] =>
    val formValidationResult: Form[SelectedSeriesData] = selectedSeriesForm.bindFromRequest

    val errorFunction: Form[SelectedSeriesData] => Future[Result] = { formWithErrors: Form[SelectedSeriesData] =>
      getSeriesDetails(request, BadRequest, formWithErrors)
    }

    val successFunction: SelectedSeriesData => Future[Result] = { formData: SelectedSeriesData =>
      val addConsignmentInput: AddConsignmentInput = AddConsignmentInput(UUID.fromString(formData.seriesId))
      val variables: addConsignment.Variables = AddConsignment.addConsignment.Variables(addConsignmentInput)

      addConsignmentClient.getResult(request.token.bearerAccessToken, addConsignment.document, Some(variables)).map(data => {
        if(data.data.isDefined) {
          Redirect(routes.TransferAgreementController.transferAgreement(data.data.get.addConsignment.consignmentid.get))
        } else {
          BadRequest(views.html.error(data.errors.map(e => e.message).mkString))
        }
      })
    }
    formValidationResult.fold(
      errorFunction,
      successFunction
    )
  }
}

case class SelectedSeriesData (seriesId: String)