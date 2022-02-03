package controllers

import java.util.UUID
import auth.TokenSecurity
import configuration.{FrontEndInfoConfiguration, GraphQLConfiguration, KeycloakConfiguration}

import javax.inject.{Inject, Singleton}
import org.pac4j.play.scala.SecurityComponents
import play.api.i18n.I18nSupport
import play.api.mvc.{Action, AnyContent, Request, RequestHeader}
import services.ConsignmentService
import viewsapi.Caching.preventCaching

import scala.concurrent.{ExecutionContext, Future}

@Singleton
class FileChecksController @Inject()(val controllerComponents: SecurityComponents,
                                     val graphqlConfiguration: GraphQLConfiguration,
                                     val keycloakConfiguration: KeycloakConfiguration,
                                     val consignmentService: ConsignmentService,
                                     val frontEndInfoConfiguration: FrontEndInfoConfiguration
                                    )(implicit val ec: ExecutionContext) extends TokenSecurity with I18nSupport {

  private def getRecordProcessingProgress(request: Request[AnyContent], consignmentId: UUID)
                                         (implicit requestHeader: RequestHeader): Future[FileChecksProgress] = {
    consignmentService.getConsignmentFileChecks(consignmentId, request.token.bearerAccessToken)
      .map{
        fileCheckProgress => {
          FileChecksProgress(fileCheckProgress.totalFiles,
                            fileCheckProgress.fileChecks.antivirusProgress.filesProcessed * 100 / fileCheckProgress.totalFiles,
                            fileCheckProgress.fileChecks.checksumProgress.filesProcessed * 100 / fileCheckProgress.totalFiles,
                            fileCheckProgress.fileChecks.ffidProgress.filesProcessed * 100 / fileCheckProgress.totalFiles)
        }
      }
  }

  def recordProcessingPage(consignmentId: UUID): Action[AnyContent] = standardTypeAction(consignmentId) { implicit request: Request[AnyContent] =>
    getRecordProcessingProgress(request, consignmentId)
      .map {
        fileChecks => {
          Ok(views.html.standard.fileChecksProgress(consignmentId, fileChecks, frontEndInfoConfiguration.frontEndInfo, request.token.name)).uncache()
        }
      }
  }

  def judgmentProcessingPage(consignmentId: UUID): Action[AnyContent] = judgmentTypeAction(consignmentId) { implicit request: Request[AnyContent] =>
    getRecordProcessingProgress(request, consignmentId)
      .map {
        fileChecks => {
          Ok(views.html.judgment.judgmentFileChecksProgress(consignmentId, fileChecks, frontEndInfoConfiguration.frontEndInfo, request.token.name)).uncache()
        }
      }
  }
}

case class FileChecksProgress(totalFiles: Int, avMetadataProgressPercentage: Int, checksumProgressPercentage: Int, ffidMetadataProgressPercentage: Int) {
  def isComplete: Boolean = avMetadataProgressPercentage == 100 && checksumProgressPercentage == 100 && ffidMetadataProgressPercentage == 100
}
