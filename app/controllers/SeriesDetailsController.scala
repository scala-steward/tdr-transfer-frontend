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
import play.api.mvc.{Action, AnyContent, Request, Result}

import scala.concurrent.{ExecutionContext, Future}

@Singleton
class SeriesDetailsController @Inject()(val controllerComponents: SecurityComponents,
                                        val graphqlConfiguration: GraphQLConfiguration,
                                        val keycloakConfiguration: KeycloakConfiguration
                                        )(implicit val ec: ExecutionContext) extends TokenSecurity with I18nSupport {

  private val secureAction = Secure("OidcClient")
  private val getSeriesClient = graphqlConfiguration.getClient[getSeries.Data, getSeries.Variables]()
  private val addConsignmentClient = graphqlConfiguration.getClient[addConsignment.Data, addConsignment.Variables]()

  val selectedSeriesForm = Form(
    mapping(
      "series" -> nonEmptyText
    )(SelectedSeriesData.apply)(SelectedSeriesData.unapply)
  )

  def seriesDetails(): Action[AnyContent] = secureAction.async { implicit request: Request[AnyContent] =>
    val userTransferringBody = keycloakConfiguration.verifyToken(request.token.getValue)
      .map(t => t.getOtherClaims.get("body").asInstanceOf[String])
    val variables: getSeries.Variables = new getSeries.Variables(userTransferringBody)

    getSeriesClient.getResult(request.token, getSeries.document, Some(variables)).map(data => {
      if (data.data.isDefined) {
        val seriesData: Seq[(String, String)] = data.data.get.getSeries.map(s => (s.seriesid.toString, s.code.getOrElse("")))
        Ok(views.html.seriesDetails(seriesData, selectedSeriesForm))
      } else {
        Ok(views.html.error(data.errors.map(e => e.message).mkString))
      }
    })

  }

  // Submit returns current page until next page is ready
  def seriesSubmit(): Action[AnyContent] =  secureAction.async { implicit request: Request[AnyContent] =>
    val formValidationResult: Form[SelectedSeriesData] = selectedSeriesForm.bindFromRequest

    val errorFunction: Form[SelectedSeriesData] => Future[Result] = { formWithErrors: Form[SelectedSeriesData] =>
      Future {
        BadRequest(views.html.seriesDetails(Seq(), formWithErrors))
      }
    }

    val successFunction: SelectedSeriesData => Future[Result] = { formData: SelectedSeriesData =>
      val userId = keycloakConfiguration.verifyToken(request.token.getValue)
        .map(t => t.getOtherClaims.get("user_id").asInstanceOf[String])
      val addConsignmentInput: AddConsignmentInput = AddConsignmentInput(formData.seriesId.toLong, UUID.fromString(userId.get))
      val variables: addConsignment.Variables = AddConsignment.addConsignment.Variables(addConsignmentInput)

      addConsignmentClient.getResult(request.token, addConsignment.document, Some(variables)).map(data => {
        if(data.data.isDefined) {
          Redirect(routes.TransferAgreementController.transferAgreement(data.data.get.addConsignment.consignmentid.get))
        } else {
          Redirect(routes.ErrorController.error(data.errors.map(e => e.message).mkString))
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
