import AppIntents
internal import ExpoAppIntents
import Foundation

struct ListChallengesIntent: AppIntent {
  static let title: LocalizedStringResource = "List Sign-in Requests"
  static let authenticationPolicy: IntentAuthenticationPolicy = .requiresAuthentication

  func perform() async throws -> some IntentResult & ReturnsValue<[ChallengeEntity]> & ProvidesDialog {
    let challenges = try await ChallengeQuery().suggestedEntities()
    return .result(value: challenges, dialog: "Found \(challenges.count) unexpired sign-in requests in the last synced catalog.")
  }
}

struct ChallengeEntity: AppEntity {
  static let typeDisplayRepresentation: TypeDisplayRepresentation = "Sign-in Request"
  static let defaultQuery = ChallengeQuery()

  var id: String
  @Property(title: "Title") var title: String
  @Property(title: "Details") var details: String

  var displayRepresentation: DisplayRepresentation {
    DisplayRepresentation(title: "\(title)", subtitle: "\(details)")
  }

  init(record: AppIntentEntityRecord) {
    id = record.id
    title = record.title
    details = record.subtitle ?? ""
  }
}

struct ChallengeQuery: EntityStringQuery {
  func entities(for identifiers: [String]) async throws -> [ChallengeEntity] {
    try await suggestedEntities().filter { identifiers.contains($0.id) }
  }

  func suggestedEntities() async throws -> [ChallengeEntity] {
    let now = Date().timeIntervalSince1970 * 1000
    return try await AppIntentEntityStore.shared.entities(ofKind: "pushChallenge")
      .filter { record in
        guard let expiry = record.metadata["expiresAt"], let expiresAt = Double(expiry) else {
          return false
        }
        return expiresAt > now
      }
      .map(ChallengeEntity.init(record:))
  }

  func entities(matching string: String) async throws -> [ChallengeEntity] {
    let search = string.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !search.isEmpty else { return [] }
    return try await suggestedEntities().filter { challenge in
      [challenge.title, challenge.details].contains { term in
        term.range(of: search, options: [.caseInsensitive, .diacriticInsensitive]) != nil
      }
    }
  }
}

private enum ChallengeIntentError: Error, LocalizedError {
  case unavailable

  var errorDescription: String? {
    "This request is no longer available. Open the app to check for new sign-in requests."
  }
}

struct ApproveChallengeIntent: AppIntent {
  static let title: LocalizedStringResource = "Approve Sign-in Request"
  static let openAppWhenRun = true
  static let authenticationPolicy: IntentAuthenticationPolicy = .requiresAuthentication

  @Parameter(title: "Sign-in Request") var challenge: ChallengeEntity

  static var parameterSummary: some ParameterSummary {
    Summary("Approve \(\.$challenge)")
  }

  @MainActor
  func perform() async throws -> some IntentResult & ProvidesDialog {
    guard let current = try await ChallengeQuery().entities(for: [challenge.id]).first else {
      throw ChallengeIntentError.unavailable
    }
    try await requestConfirmation(result: .result(
      dialog: "Approve \(current.title)? \(current.details) Only approve if you started this sign-in."
    ))
    await AppIntentDispatcher.shared.dispatch(
      name: "respondToChallenge",
      params: ["requestId": .string(current.id), "approve": .bool(true)]
    )
    return .result(dialog: "Opening the app to send your approval. Check the app for the result.")
  }
}

struct DenyChallengeIntent: AppIntent {
  static let title: LocalizedStringResource = "Deny Sign-in Request"
  static let openAppWhenRun = true
  static let authenticationPolicy: IntentAuthenticationPolicy = .requiresAuthentication

  @Parameter(title: "Sign-in Request") var challenge: ChallengeEntity

  static var parameterSummary: some ParameterSummary {
    Summary("Deny \(\.$challenge)")
  }

  @MainActor
  func perform() async throws -> some IntentResult & ProvidesDialog {
    guard let current = try await ChallengeQuery().entities(for: [challenge.id]).first else {
      throw ChallengeIntentError.unavailable
    }
    try await requestConfirmation(result: .result(
      dialog: "Deny \(current.title)? \(current.details)"
    ))
    await AppIntentDispatcher.shared.dispatch(
      name: "respondToChallenge",
      params: ["requestId": .string(current.id), "approve": .bool(false)]
    )
    return .result(dialog: "Opening the app to send your denial. Check the app for the result.")
  }
}
