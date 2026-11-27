import UIKit
import UserNotifications
import UserNotificationsUI

final class NotificationViewController: UIViewController, UNNotificationContentExtension {
  private let stack = UIStackView()
  private let icon = UIImageView(image: UIImage(systemName: "checkmark.shield.fill"))
  private let titleLabel = UILabel()
  private let messageLabel = UILabel()
  private let accountLabel = UILabel()
  private let serviceLabel = UILabel()
  private let statusLabel = UILabel()
  private let expiryBar = UIProgressView(progressViewStyle: .default)
  private let expiryDetailLabel = UILabel()
  private var expiryTimer: Timer?
  private var imageTask: Task<Void, Never>?

  override func loadView() {
    let scroll = UIScrollView()
    scroll.alwaysBounceVertical = false
    view = scroll
    view.backgroundColor = .systemBackground
    stack.axis = .vertical
    stack.spacing = 16
    stack.translatesAutoresizingMaskIntoConstraints = false
    scroll.addSubview(stack)
    NSLayoutConstraint.activate([
      stack.leadingAnchor.constraint(equalTo: scroll.contentLayoutGuide.leadingAnchor, constant: 20),
      stack.trailingAnchor.constraint(equalTo: scroll.contentLayoutGuide.trailingAnchor, constant: -20),
      stack.topAnchor.constraint(equalTo: scroll.contentLayoutGuide.topAnchor, constant: 20),
      stack.bottomAnchor.constraint(equalTo: scroll.contentLayoutGuide.bottomAnchor, constant: -20),
      stack.widthAnchor.constraint(equalTo: scroll.frameLayoutGuide.widthAnchor, constant: -40),
    ])
    icon.tintColor = .systemBlue
    icon.contentMode = .scaleAspectFit
    icon.layer.cornerRadius = 8
    icon.clipsToBounds = true
    icon.isAccessibilityElement = false
    NSLayoutConstraint.activate([
      icon.widthAnchor.constraint(equalToConstant: 32),
      icon.heightAnchor.constraint(equalToConstant: 36),
    ])
    configure(titleLabel, style: .headline)
    configure(messageLabel, style: .body)
    let header = UIStackView(arrangedSubviews: [icon, titleLabel])
    header.spacing = 12
    header.alignment = .center
    stack.addArrangedSubview(header)
    stack.addArrangedSubview(messageLabel)
    let separator = UIView()
    separator.backgroundColor = .separator
    separator.heightAnchor.constraint(equalToConstant: 1).isActive = true
    stack.addArrangedSubview(separator)
    for label in [accountLabel, serviceLabel] {
      configure(label, style: .subheadline)
      label.textColor = .secondaryLabel
      stack.addArrangedSubview(label)
    }
    configure(statusLabel, style: .subheadline)
    statusLabel.textColor = .secondaryLabel
    expiryBar.progressTintColor = .systemBlue
    expiryBar.trackTintColor = .tertiarySystemFill
    expiryBar.transform = CGAffineTransform(scaleX: 1, y: 2)
    expiryBar.isAccessibilityElement = false
    configure(expiryDetailLabel, style: .footnote)
    expiryDetailLabel.textColor = .secondaryLabel
    expiryDetailLabel.text = text("Start a new sign-in to get another request.")
    let statusStack = UIStackView(arrangedSubviews: [statusLabel, expiryBar, expiryDetailLabel])
    statusStack.axis = .vertical
    statusStack.spacing = 8
    stack.addArrangedSubview(statusStack)
  }

  func didReceive(_ notification: UNNotification) {
    loadViewIfNeeded()
    expiryTimer?.invalidate()
    expiryTimer = nil
    imageTask?.cancel()
    do {
      guard let group = Bundle.main.object(forInfoDictionaryKey: "EduMfaNotificationAppGroup") as? String else {
        showUnavailable()
        return
      }
      let request = try NotificationPushRequest.from(
        userInfo: notification.request.content.userInfo,
        identifier: notification.request.identifier, date: notification.date
      )
      let state = try NotificationJournalStore(appGroup: group).read()
      guard let preview = try NotificationPreview.make(request: request, state: state, verify: { request, token in
        try EduMfaRsaCrypto().verify(
          message: request.signedData(version: token.version),
          signatureBase64: NotificationBase32.decode(request.signature).base64EncodedString(),
          publicKey: token.serverPublicKey, algorithm: "SHA256"
        )
      }) else {
        showUnavailable()
        return
      }
      titleLabel.text = preview.title
      let attachmentImage = tokenImage(from: notification.request.content.attachments)
      icon.image = attachmentImage ?? UIImage(systemName: "checkmark.shield.fill")
      if attachmentImage == nil, let imageUrl = preview.imageUrl {
        imageTask = Task { [weak self] in
          guard let png = try? await NotificationTokenImage.download(imageUrl),
                !Task.isCancelled, let image = UIImage(data: png) else { return }
          self?.icon.image = image
        }
      }
      icon.tintColor = .systemBlue
      for label in [accountLabel, serviceLabel, statusLabel] { label.isHidden = false }
      messageLabel.text = preview.question ?? text("Do you want to confirm the sign-in?")
      accountLabel.text = String(format: text("Account: %@"), preview.account)
      serviceLabel.text = String(format: text("Server: %@"), preview.service)
      serviceLabel.isHidden = preview.service.isEmpty
      expiryBar.isHidden = true
      expiryDetailLabel.isHidden = true
      statusLabel.font = .preferredFont(forTextStyle: .subheadline)
      switch preview.status {
      case "accepted": statusLabel.text = text("Accepted")
      case "declined": statusLabel.text = text("Declined")
      case "expired": showExpired()
      case "dismissed": statusLabel.text = text("Dismissed")
      default: startCountdown(preview)
      }
    } catch {
      showUnavailable()
    }
    view.setNeedsLayout()
  }

  private func startCountdown(_ preview: NotificationPreview) {
    expiryBar.isHidden = false
    let font = UIFont.preferredFont(forTextStyle: .subheadline)
    statusLabel.font = .monospacedDigitSystemFont(ofSize: font.pointSize, weight: .regular)
    guard updateCountdown(preview) else { return }
    let timer = Timer(timeInterval: 0.25, repeats: true) { [weak self] timer in
      guard let self, self.updateCountdown(preview) else {
        timer.invalidate()
        return
      }
    }
    expiryTimer = timer
    RunLoop.main.add(timer, forMode: .common)
  }

  private func updateCountdown(_ preview: NotificationPreview) -> Bool {
    let countdown = preview.countdown(at: Date())
    guard countdown.seconds > 0 else {
      showExpired()
      return false
    }
    let remaining = Duration.seconds(countdown.seconds).formatted(.time(pattern: .minuteSecond))
    statusLabel.text = String(format: text("Expires in %@"), remaining)
    expiryBar.setProgress(countdown.fraction, animated: false)
    return true
  }

  private func showExpired() {
    statusLabel.text = text("Expired")
    statusLabel.font = .preferredFont(forTextStyle: .subheadline)
    expiryBar.isHidden = true
    expiryDetailLabel.isHidden = false
    view.setNeedsLayout()
  }

  private func tokenImage(from attachments: [UNNotificationAttachment]) -> UIImage? {
    guard let attachment = attachments.first(where: { $0.identifier == NotificationTokenImage.attachmentIdentifier }) else {
      return nil
    }
    let url = attachment.url
    let hasAccess = url.startAccessingSecurityScopedResource()
    defer { if hasAccess { url.stopAccessingSecurityScopedResource() } }
    guard let data = try? Data(contentsOf: url) else { return nil }
    return UIImage(data: data)
  }

  override func viewDidLayoutSubviews() {
    super.viewDidLayoutSubviews()
    let width = max(view.bounds.width - 40, 1)
    let height = stack.systemLayoutSizeFitting(
      CGSize(width: width, height: 0),
      withHorizontalFittingPriority: .required, verticalFittingPriority: .fittingSizeLevel
    ).height + 40
    let size = CGSize(width: view.bounds.width, height: min(max(height, 180), 480))
    if abs(preferredContentSize.height - size.height) > 1 { preferredContentSize = size }
  }

  private func showUnavailable() {
    icon.image = UIImage(systemName: "exclamationmark.shield")
    icon.tintColor = .secondaryLabel
    titleLabel.text = text("Sign-in request")
    messageLabel.text = text("Open eduMFA Push to review this request.")
    for label in [accountLabel, serviceLabel, statusLabel] { label.isHidden = true }
    expiryBar.isHidden = true
    expiryDetailLabel.isHidden = true
    view.setNeedsLayout()
  }

  private func configure(_ label: UILabel, style: UIFont.TextStyle) {
    label.font = .preferredFont(forTextStyle: style)
    label.adjustsFontForContentSizeCategory = true
    label.numberOfLines = 0
  }

  private func text(_ key: String) -> String {
    NSLocalizedString(key, tableName: "NotificationPreview", bundle: .main, comment: "")
  }

  deinit {
    expiryTimer?.invalidate()
    imageTask?.cancel()
  }
}
