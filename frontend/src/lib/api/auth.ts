import type { AuthApi } from "./contracts"
import type { HttpClient } from "./http"
import type {
  InitiateLoginResponse,
  InitiateSignupResponse,
  InvitationPreview,
  Me,
  MembershipsResponse,
  RefreshResponse,
  ResendOtpResponse,
  SessionsResponse,
  TokenResponse,
  VerifySignupResponse,
} from "./types"

// Nothing here renews the session on a 401: a failed login or refresh must
// surface as such instead of starting another refresh.
const noRenew = { renewSession: false } as const

export function createAuthApi(http: HttpClient): AuthApi {
  return {
    memberships: (email) =>
      http.post<MembershipsResponse>("/auth/passwordless/tenants", {
        body: { email },
        ...noRenew,
      }),
    initiateLogin: (body) =>
      http.post<InitiateLoginResponse>("/auth/passwordless/login/initiate", {
        body,
        ...noRenew,
      }),
    verifyLogin: (body) =>
      http.post<TokenResponse>("/auth/passwordless/login/verify", {
        body,
        ...noRenew,
      }),
    resendOtp: (body) =>
      http.post<ResendOtpResponse>("/auth/passwordless/resend-otp", {
        body,
        ...noRenew,
      }),
    lookupInvitation: (invitationToken) =>
      http.post<InvitationPreview>("/auth/passwordless/signup/invitation", {
        body: { invitation_token: invitationToken },
        ...noRenew,
      }),
    initiateSignup: (body) =>
      http.post<InitiateSignupResponse>("/auth/passwordless/signup/initiate", {
        body,
        ...noRenew,
      }),
    verifySignup: (body) =>
      http.post<VerifySignupResponse>("/auth/passwordless/signup/verify", {
        body,
        ...noRenew,
      }),
    refresh: () => http.post<RefreshResponse>("/auth/refresh", noRenew),
    logout: () => http.post<void>("/auth/logout", noRenew),
    logoutAll: () => http.post<void>("/auth/logout/all"),
    me: () => http.get<Me>("/auth/me"),
    sessions: () => http.get<SessionsResponse>("/auth/sessions"),
  }
}
