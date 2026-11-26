import Foundation

struct NotificationPreview {
  let title: String
  let question: String
  let account: String
  let service: String
  let status: String
  let expiresAt: Date

  static func make(
    request: NotificationPushRequest,
    state: NotificationJournalState,
    verify: (NotificationPushRequest, NotificationToken) throws -> Bool
  ) throws -> Self? {
    guard let token = state.tokens.first(where: { $0.id == request.serial }),
          try verify(request, token) else { return nil }
    let known = state.entries[request.key]?.request ?? request
    let status = known.status == "pending" && known.isExpired ? "expired" : known.status
    return Self(
      title: request.title,
      question: request.question,
      account: token.label.flatMap { $0.isEmpty ? nil : $0 } ?? token.id,
      service: URL(string: token.callbackUrl)?.host ?? token.issuer ?? "",
      status: status,
      expiresAt: Date(timeIntervalSince1970: known.sentAt / 1000 + 120)
    )
  }
}
