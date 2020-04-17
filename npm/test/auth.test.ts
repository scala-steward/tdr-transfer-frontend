import { getKeycloakInstance } from "../src/auth"
jest.mock("keycloak-js")

import Keycloak, { KeycloakInstance } from "keycloak-js"

class MockKeycloakAuthenticated {
  token: string = "fake-auth-token"

  init() {
    return new Promise((resolve, _) => resolve(true))
  }
}
class MockKeycloakUnauthenticated {
  init() {
    return new Promise((resolve, _) => resolve(false))
  }
}
class MockKeycloakError {
  init() {
    return new Promise((_, reject) => reject("There has been an error"))
  }
}

beforeEach(() => jest.resetModules())

test("Returns an error if the user is not logged in", async () => {
  ;(Keycloak as jest.Mock).mockImplementation(() => {
    return new MockKeycloakUnauthenticated()
  })
  await expect(getKeycloakInstance()).rejects.toEqual(
    "User is not authenticated"
  )
})

test("Returns a token if the user is logged in", async () => {
  ;(Keycloak as jest.Mock).mockImplementation(() => {
    return new MockKeycloakAuthenticated()
  })
  await expect(getKeycloakInstance()).resolves.toEqual({
    token: "fake-auth-token"
  })
})

test("Returns an error if login attempt fails", async () => {
  ;(Keycloak as jest.Mock).mockImplementation(() => {
    return new MockKeycloakError()
  })
  await expect(getKeycloakInstance()).rejects.toEqual("There has been an error")
})
