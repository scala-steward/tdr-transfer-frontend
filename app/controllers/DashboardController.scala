package controllers

import auth.TokenSecurity
import configuration.KeycloakConfiguration
import org.pac4j.play.scala.SecurityComponents
import play.api.i18n.I18nSupport
import play.api.mvc.{Action, AnyContent, Request}
import services.ConsignmentService

import javax.inject.{Inject, Singleton}
import scala.concurrent.ExecutionContext

@Singleton
class DashboardController @Inject()(val controllerComponents: SecurityComponents,
                                    val keycloakConfiguration: KeycloakConfiguration,
                                    val consignmentService: ConsignmentService)
                                   (implicit val ec: ExecutionContext) extends TokenSecurity with I18nSupport {

  def dashboard(): Action[AnyContent] = secureAction { implicit request: Request[AnyContent] => {
      if (request.token.isJudgmentUser) {
        Ok(views.html.judgmentDashboard())
      } else {
        Ok(views.html.dashboard())
      }
    }
  }
}

