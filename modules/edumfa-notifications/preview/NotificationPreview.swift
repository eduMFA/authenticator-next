import Foundation

struct NotificationPreview {
  let title: String
  let question: String?
  let account: String
  let imageUrl: String?
  let service: String
  let status: String
  let expiresAt: Date

  func countdown(at date: Date) -> (seconds: Int, fraction: Float) {
    let lifetime = NotificationPushRequest.lifetime
    let remaining = min(lifetime, max(0, expiresAt.timeIntervalSince(date)))
    return (Int(ceil(remaining)), Float(remaining / lifetime))
  }

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
      imageUrl: token.imageUrl,
      service: URL(string: token.callbackUrl)?.host ?? token.issuer ?? "",
      status: status,
      expiresAt: known.expiresAt
    )
  }
}
