package controllers

import java.util.UUID

import auth.TokenSecurity
import configuration.{FrontEndInfoConfiguration, GraphQLConfiguration, KeycloakConfiguration}
import javax.inject.{Inject, Singleton}
import org.pac4j.play.scala.SecurityComponents
import play.api.i18n.I18nSupport
import play.api.mvc.{Action, AnyContent, Request, RequestHeader}
import services.ConsignmentService

import scala.concurrent.{ExecutionContext, Future}

@Singleton
class FileChecksResultsController @Inject()(val controllerComponents: SecurityComponents,
                                            val keycloakConfiguration: KeycloakConfiguration,
                                            val graphqlConfiguration: GraphQLConfiguration,
                                            val consignmentService: ConsignmentService,
                                            val frontEndInfoConfiguration: FrontEndInfoConfiguration
                                           )(implicit val ec: ExecutionContext) extends TokenSecurity with I18nSupport {

  def fileCheckResultsPage(consignmentId: UUID): Action[AnyContent] = secureAction.async { implicit request: Request[AnyContent] =>
    consignmentService.getConsignmentFileChecks(consignmentId, request.token.bearerAccessToken).map(fileCheck => {
      if(fileCheck.allChecksSucceeded) {
        val consignmentInfo = ConsignmentFolderInfo(
          fileCheck.totalFiles,
          fileCheck.parentFolder.getOrElse(throw new IllegalStateException(s"No parent folder found for consignment: '$consignmentId'"))
        )
        Ok(views.html.fileChecksResults(consignmentInfo, consignmentId))
      } else {
        Redirect(routes.FileChecksResultsController.fileCheckFailurePage(consignmentId))
      }
    })
  }

  //noinspection ScalaUnusedSymbol
  //Consignment id is unused but if we want to keep the url as /consignment/:consignmentId/checks-failure which I think we do, it needs to be here
  def fileCheckFailurePage(consignmentId: UUID): Action[AnyContent] = secureAction { implicit request: Request[AnyContent] =>
    Ok(views.html.fileChecksFailed())
  }

}

case class ConsignmentFolderInfo(numberOfFiles: Int, parentFolder: String)
