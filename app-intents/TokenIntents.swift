import AppIntents
internal import ExpoAppIntents

struct ListTokensIntent: AppIntent {
  static let title: LocalizedStringResource = "List Push Tokens"
  static let authenticationPolicy: IntentAuthenticationPolicy = .requiresAuthentication

  func perform() async throws -> some IntentResult & ReturnsValue<[TokenEntity]> & ProvidesDialog {
    let tokens = try await TokenQuery().suggestedEntities()
    return .result(value: tokens, dialog: "Found \(tokens.count) push tokens in the last synced catalog.")
  }
}

struct OpenTokensIntent: AppIntent {
  static let title: LocalizedStringResource = "Open Push Tokens"
  static let openAppWhenRun = true
  static let authenticationPolicy: IntentAuthenticationPolicy = .requiresAuthentication

  @MainActor
  func perform() async throws -> some IntentResult & ProvidesDialog {
    await AppIntentDispatcher.shared.dispatch(name: "openTokens", params: [:])
    return .result(dialog: "Opening your push tokens.")
  }
}

struct OpenTokenIntent: AppIntent {
  static let title: LocalizedStringResource = "Open Push Token"
  static let openAppWhenRun = true
  static let authenticationPolicy: IntentAuthenticationPolicy = .requiresAuthentication

  @Parameter(title: "Push Token")
  var token: TokenEntity

  static var parameterSummary: some ParameterSummary {
    Summary("Open \(\.$token)")
  }

  @MainActor
  func perform() async throws -> some IntentResult & ProvidesDialog {
    await AppIntentDispatcher.shared.dispatch(
      name: "openToken", params: ["tokenId": .string(token.id)]
    )
    return .result(dialog: "Opening the app to view your push token.")
  }
}

struct PairTokenIntent: AppIntent {
  static let title: LocalizedStringResource = "Pair Push Token"
  static let openAppWhenRun = true
  static let authenticationPolicy: IntentAuthenticationPolicy = .requiresAuthentication

  @MainActor
  func perform() async throws -> some IntentResult & ProvidesDialog {
    await AppIntentDispatcher.shared.dispatch(name: "pairToken", params: [:])
    return .result(dialog: "Opening the app to pair a push token.")
  }
}

struct EduMfaShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: ListTokensIntent(),
      phrases: ["List push tokens in \(.applicationName)"],
      shortTitle: "List Tokens",
      systemImageName: "list.bullet"
    )
    AppShortcut(
      intent: OpenTokensIntent(),
      phrases: ["Open push tokens in \(.applicationName)"],
      shortTitle: "Open Tokens",
      systemImageName: "key.fill"
    )
    AppShortcut(
      intent: OpenTokenIntent(),
      phrases: ["Open \(\.$token) in \(.applicationName)"],
      shortTitle: "Open Token",
      systemImageName: "key"
    )
    AppShortcut(
      intent: PairTokenIntent(),
      phrases: ["Pair a push token in \(.applicationName)"],
      shortTitle: "Pair Token",
      systemImageName: "qrcode.viewfinder"
    )
    AppShortcut(
      intent: ListChallengesIntent(),
      phrases: ["List sign-in requests in \(.applicationName)"],
      shortTitle: "List Sign-ins",
      systemImageName: "list.bullet.clipboard"
    )
    AppShortcut(
      intent: ApproveChallengeIntent(),
      phrases: ["Approve a sign-in request in \(.applicationName)"],
      shortTitle: "Approve Sign-in",
      systemImageName: "checkmark.shield"
    )
    AppShortcut(
      intent: DenyChallengeIntent(),
      phrases: ["Deny a sign-in request in \(.applicationName)"],
      shortTitle: "Deny Sign-in",
      systemImageName: "xmark.shield"
    )
  }
}
