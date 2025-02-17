package controllers

import com.github.tomakehurst.wiremock.WireMockServer
import com.github.tomakehurst.wiremock.stubbing.StubMapping
import com.github.tomakehurst.wiremock.client.WireMock.{containing, okJson, post, urlEqualTo}
import configuration.GraphQLConfiguration
import play.api.Play.materializer
import play.api.test.CSRFTokenHelper._
import play.api.test.FakeRequest
import play.api.test.Helpers.{GET, contentAsString, contentType, status => playStatus, _}
import services.ConsignmentService
import util.FrontEndTestHelper
import graphql.codegen.GetConsignmentReference.{getConsignmentReference => gcr}
import io.circe.syntax.EncoderOps
import io.circe.Printer
import io.circe.generic.auto._

import java.util.UUID
import scala.concurrent.ExecutionContext

class BeforeUploadingControllerSpec extends FrontEndTestHelper {
  implicit val ec: ExecutionContext = ExecutionContext.global

  val wiremockServer = new WireMockServer(9006)

  override def beforeEach(): Unit = {
    wiremockServer.start()
  }

  override def afterEach(): Unit = {
    wiremockServer.resetAll()
    wiremockServer.stop()
  }

  "BeforeUploadingController GET" should {
    "render the before uploading page for judgments" in {
      val consignmentId = UUID.fromString("c2efd3e6-6664-4582-8c28-dcf891f60e68")
      val beforeUploadingController = instantiateBeforeUploadingController
      setConsignmentTypeResponse(wiremockServer, "judgment")
      setConsignmentReferenceResponse()

      val beforeUploadingPage = beforeUploadingController.beforeUploading(consignmentId)
        .apply(FakeRequest(GET, s"/judgment/$consignmentId/before-uploading").withCSRFToken)
      val beforeUploadingPageAsString = contentAsString(beforeUploadingPage)

      playStatus(beforeUploadingPage) mustBe OK
      contentType(beforeUploadingPage) mustBe Some("text/html")
      beforeUploadingPageAsString must include("Your upload must contain the following information:")
      beforeUploadingPageAsString must include(s"""<a href="/judgment/$consignmentId/upload"""" +
        """ role="button" draggable="false" class="govuk-button" data-module="govuk-button">""")
      beforeUploadingPageAsString must include(
        s"""<a href="mailto:judgments@nationalarchives.gov.uk?subject=TEST-TDR-2021-GB">""" +
          """judgments@nationalarchives.gov.uk</a>""")
    }
  }

  s"The judgment before uploading page" should {
    s"return 403 if the GET is accessed by a non-judgment user" in {
      val consignmentId = UUID.fromString("c2efd3e6-6664-4582-8c28-dcf891f60e68")
      val beforeUploadingController: BeforeUploadingController = instantiateBeforeUploadingController

      val beforeUploading = {
        setConsignmentTypeResponse(wiremockServer, "standard")
        beforeUploadingController.beforeUploading(consignmentId)
          .apply(FakeRequest(GET, s"/judgment/$consignmentId/before-uploading").withCSRFToken)
      }

      playStatus(beforeUploading) mustBe FORBIDDEN
    }
  }

  private def instantiateBeforeUploadingController = {
    val graphQLConfiguration = new GraphQLConfiguration(app.configuration)
    val consignmentService = new ConsignmentService(graphQLConfiguration)

    new BeforeUploadingController(
      getAuthorisedSecurityComponents,
      new GraphQLConfiguration(app.configuration),
      getValidJudgmentUserKeycloakConfiguration,
      consignmentService
    )
  }

  private def setConsignmentReferenceResponse(): StubMapping = {
    val client = new GraphQLConfiguration(app.configuration).getClient[gcr.Data, gcr.Variables]()
    val consignmentReferenceResponse: gcr.GetConsignment = new gcr.GetConsignment("TEST-TDR-2021-GB")
    val data: client.GraphqlData = client.GraphqlData(Some(gcr.Data(Some(consignmentReferenceResponse))), List())
    val dataString: String = data.asJson.printWith(Printer(dropNullValues = false, ""))

    wiremockServer.stubFor(post(urlEqualTo("/graphql"))
      .withRequestBody(containing("getConsignmentReference"))
      .willReturn(okJson(dataString)))
  }
}
