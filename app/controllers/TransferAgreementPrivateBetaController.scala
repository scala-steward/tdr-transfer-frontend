package controllers

import auth.TokenSecurity
import configuration.{GraphQLConfiguration, KeycloakConfiguration}
import org.pac4j.play.scala.SecurityComponents
import play.api.data.Form
import play.api.data.Forms._
import play.api.i18n.{I18nSupport, Messages}
import play.api.mvc.{Action, AnyContent, Request, Result}
import services.{ConsignmentService, ConsignmentStatusService, TransferAgreementService}
import viewsapi.Caching.preventCaching

import java.util.UUID
import javax.inject.{Inject, Singleton}
import scala.concurrent.{ExecutionContext, Future}

@Singleton
class TransferAgreementPrivateBetaController @Inject()(val controllerComponents: SecurityComponents,
                                                       val graphqlConfiguration: GraphQLConfiguration,
                                                       val transferAgreementService: TransferAgreementService,
                                                       val keycloakConfiguration: KeycloakConfiguration,
                                                       val consignmentService: ConsignmentService)
                                                      (implicit val ec: ExecutionContext) extends TokenSecurity with I18nSupport {
  val transferAgreementForm: Form[TransferAgreementData] = Form(
    mapping(
      "publicRecord" -> boolean
        .verifying("All records must be confirmed as public before proceeding", b => b),
      "crownCopyright" -> boolean
        .verifying("All records must be confirmed Crown Copyright before proceeding", b => b),
      "english" -> boolean
        .verifying("All records must be confirmed as English language before proceeding", b => b)
    )(TransferAgreementData.apply)(TransferAgreementData.unapply)
  )

  val transferAgreementFormNameAndLabel = Seq(
    ("publicRecord", "I confirm that the records are Public Records."),
    ("crownCopyright", "I confirm that the records are all Crown Copyright."),
    ("english", "I confirm that the records are all in English.")
  )

  private def loadStandardPageBasedOnTaStatus(consignmentId: UUID, httpStatus: Status, taForm: Form[TransferAgreementData] = transferAgreementForm)
                                        (implicit request: Request[AnyContent]): Future[Result] = {
    val consignmentStatusService = new ConsignmentStatusService(graphqlConfiguration)

    consignmentStatusService.consignmentStatus(consignmentId, request.token.bearerAccessToken).map {
      consignmentStatus =>
        val transferAgreementStatus: Option[String] = consignmentStatus.flatMap(_.transferAgreement)
        val warningMessage = Messages("transferAgreement.warning")
        transferAgreementStatus match {
          case Some("InProgress") | Some("Completed") =>
            Ok(views.html.standard.transferAgreementPrivateBetaAlreadyConfirmed(
              consignmentId, transferAgreementForm, transferAgreementFormNameAndLabel, warningMessage, request.token.name)).uncache()
          case _ => httpStatus(
            views.html.standard.transferAgreementPrivateBeta(
              consignmentId, taForm, transferAgreementFormNameAndLabel, warningMessage, request.token.name)).uncache()
        }
    }
  }

  def transferAgreement(consignmentId: UUID): Action[AnyContent] = standardTypeAction(consignmentId) { implicit request: Request[AnyContent] =>
    loadStandardPageBasedOnTaStatus(consignmentId, Ok)
  }

  def transferAgreementSubmit(consignmentId: UUID): Action[AnyContent] = standardTypeAction(consignmentId) { implicit request: Request[AnyContent] =>
    val errorFunction: Form[TransferAgreementData] => Future[Result] = { formWithErrors: Form[TransferAgreementData] =>
      loadStandardPageBasedOnTaStatus(consignmentId, BadRequest, formWithErrors)
    }

    val successFunction: TransferAgreementData => Future[Result] = { formData: TransferAgreementData =>
      val consignmentStatusService = new ConsignmentStatusService(graphqlConfiguration)

      for {
        consignmentStatus <- consignmentStatusService.consignmentStatus(consignmentId, request.token.bearerAccessToken)
        transferAgreementStatus = consignmentStatus.flatMap(_.transferAgreement)
        result <- transferAgreementStatus match {
          case Some("InProgress") => Future(Redirect(routes.TransferAgreementComplianceController.transferAgreement(consignmentId)))
          case _ => transferAgreementService.addTransferAgreementPrivateBeta(consignmentId, request.token.bearerAccessToken, formData)
            .map(_ => Redirect(routes.TransferAgreementComplianceController.transferAgreement(consignmentId)))
        }
      } yield result
    }

    val formValidationResult: Form[TransferAgreementData] = transferAgreementForm.bindFromRequest()

    formValidationResult.fold(
      errorFunction,
      successFunction
    )
  }
}

case class TransferAgreementData(publicRecord: Boolean,
                                 crownCopyright: Boolean,
                                 english: Boolean)
