import AppIntents
internal import ExpoAppIntents
import Foundation

struct TokenEntity: AppEntity {
  static let typeDisplayRepresentation: TypeDisplayRepresentation = "Push Token"
  static let defaultQuery = TokenQuery()

  var id: String
  @Property(title: "Label") var label: String
  var issuer: String?

  var displayRepresentation: DisplayRepresentation {
    if let issuer {
      return DisplayRepresentation(title: "\(label)", subtitle: "\(issuer)")
    }
    return DisplayRepresentation(title: "\(label)")
  }

  init(record: AppIntentEntityRecord) {
    id = record.id
    label = record.title
    issuer = record.subtitle
  }
}

struct TokenQuery: EntityStringQuery {
  func entities(for identifiers: [String]) async throws -> [TokenEntity] {
    try await AppIntentEntityStore.shared.entities(ofKind: "pushToken", matching: identifiers)
      .map(TokenEntity.init(record:))
  }

  func suggestedEntities() async throws -> [TokenEntity] {
    try await AppIntentEntityStore.shared.entities(ofKind: "pushToken")
      .map(TokenEntity.init(record:))
  }

  func entities(matching string: String) async throws -> [TokenEntity] {
    let search = string.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !search.isEmpty else { return [] }
    return try await suggestedEntities().filter { token in
      ([token.label] + [token.issuer].compactMap { $0 }).contains { term in
        term.range(of: search, options: [.caseInsensitive, .diacriticInsensitive]) != nil
      }
    }
  }
}
