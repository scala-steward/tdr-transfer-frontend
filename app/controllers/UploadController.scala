package controllers

import auth.TokenSecurity

import java.util.UUID
import configuration.{FrontEndInfoConfiguration, GraphQLConfiguration, KeycloakConfiguration}

import javax.inject.{Inject, Singleton}
import org.pac4j.play.scala.SecurityComponents
import play.api.i18n.I18nSupport
import play.api.mvc.{Action, AnyContent, Request}
import services.ConsignmentStatusService
import viewsapi.Caching.preventCaching

import scala.concurrent.ExecutionContext

@Singleton
class UploadController @Inject()(val controllerComponents: SecurityComponents,
                                 val graphqlConfiguration: GraphQLConfiguration,
                                 val keycloakConfiguration: KeycloakConfiguration,
                                 val frontEndInfoConfiguration: FrontEndInfoConfiguration)
                                (implicit val ec: ExecutionContext) extends TokenSecurity with I18nSupport {

  def uploadPage(consignmentId: UUID): Action[AnyContent] = secureAction.async { implicit request: Request[AnyContent] =>
    val consignmentStatusService = new ConsignmentStatusService(graphqlConfiguration)

    for {
      consignmentStatus <- consignmentStatusService.consignmentStatus(consignmentId, request.token.bearerAccessToken)
    } yield {
      val transferAgreementStatus: Option[String] = consignmentStatus.flatMap(_.transferAgreement)
      val uploadStatus: Option[String] = consignmentStatus.flatMap(_.upload)
      val pageHeading = "Uploading records"

      transferAgreementStatus match {
        case Some("Completed") =>
          uploadStatus match {
            case Some("InProgress") =>
              Ok(views.html.uploadInProgress(consignmentId, pageHeading)).uncache()
            case Some("Completed") =>
              Ok(views.html.uploadHasCompleted(consignmentId, pageHeading)).uncache()
            case _ =>
              Ok(views.html.standard.upload(consignmentId, frontEndInfoConfiguration.frontEndInfo)).uncache()
          }
        case _ =>
          Redirect(routes.TransferAgreementController.transferAgreement(consignmentId))
      }
    }
  }

  def judgmentUploadPage(consignmentId: UUID): Action[AnyContent] = secureAction.async { implicit request: Request[AnyContent] =>
    val consignmentStatusService = new ConsignmentStatusService(graphqlConfiguration)
    val isJudgmentUser = request.token.isJudgmentUser

    for {
      consignmentStatus <- consignmentStatusService.consignmentStatus(consignmentId, request.token.bearerAccessToken)
    } yield {
      val uploadStatus: Option[String] = consignmentStatus.flatMap(_.upload)
      val pageHeading = "Uploading court judgment"

      uploadStatus match {
        case Some("InProgress") =>
          Ok(views.html.uploadInProgress(consignmentId, pageHeading)).uncache()
        case Some("Completed") =>
          Ok(views.html.uploadHasCompleted(consignmentId, pageHeading)).uncache()
        case _ =>
          Ok(views.html.judgment.judgmentUpload(consignmentId, frontEndInfoConfiguration.frontEndInfo)).uncache()
      }
    }
  }
}
