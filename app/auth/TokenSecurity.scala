package auth

import com.nimbusds.oauth2.sdk.token.BearerAccessToken
import configuration.KeycloakConfiguration
import org.pac4j.core.profile.{CommonProfile, ProfileManager}
import org.pac4j.play.PlayWebContext
import play.api.i18n.I18nSupport
import play.api.mvc.{Action, AnyContent, Request, Result}
import services.ConsignmentService
import uk.gov.nationalarchives.tdr.keycloak.Token

import java.util.UUID
import scala.concurrent.{ExecutionContext, Future}

trait TokenSecurity extends OidcSecurity with I18nSupport {

  def keycloakConfiguration: KeycloakConfiguration

  def consignmentService: ConsignmentService
  implicit val executionContext: ExecutionContext = consignmentService.ec

  implicit def requestToRequestWithToken(request: Request[AnyContent]): RequestWithToken = {
    val webContext = new PlayWebContext(request, playSessionStore)
    val profileManager = new ProfileManager[CommonProfile](webContext)
    val profile = profileManager.get(true)
    val token: BearerAccessToken = profile.get().getAttribute("access_token").asInstanceOf[BearerAccessToken]
    val accessToken: Option[Token] = keycloakConfiguration.token(token.getValue)
    RequestWithToken(request, accessToken)
  }

  def judgmentTypeAction(consignmentId: UUID)(action: Request[AnyContent] => Future[Result]): Action[AnyContent] = secureAction.async { request =>
    consignmentService.getConsignmentType(consignmentId, request.token.bearerAccessToken).flatMap(consignmentType => {
      createResult(action, request, consignmentType == "judgment")
    })
  }

  def judgmentUserAction(action: Request[AnyContent] => Future[Result]): Action[AnyContent] = secureAction.async { request =>
    createResult(action, request, request.token.isJudgmentUser)
  }

  def standardUserAction(action: Request[AnyContent] => Future[Result]): Action[AnyContent] = secureAction.async { request =>
    createResult(action, request, request.token.isStandardUser)
  }

  def standardTypeAction(consignmentId: UUID)(action: Request[AnyContent] => Future[Result]): Action[AnyContent] = secureAction.async { request =>
    consignmentService.getConsignmentType(consignmentId, request.token.bearerAccessToken).flatMap(consignmentType => {
      createResult(action, request, consignmentType == "standard")
    })
  }

  private def createResult(action: Request[AnyContent] => Future[Result], request: AuthenticatedRequest[AnyContent], isPermitted: Boolean) = {
    if (isPermitted) {
      action(request)
    } else {
      Future.successful(Forbidden(views.html.forbiddenError(request.token.name)(request2Messages(request), request)))
    }
  }
}
