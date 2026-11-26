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
  private var expiryTimer: Timer?

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
    for label in [accountLabel, serviceLabel, statusLabel] {
      configure(label, style: .subheadline)
      label.textColor = .secondaryLabel
      stack.addArrangedSubview(label)
    }
  }

  func didReceive(_ notification: UNNotification) {
    loadViewIfNeeded()
    expiryTimer?.invalidate()
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
          message: request.signedData,
          signatureBase64: NotificationBase32.decode(request.signature).base64EncodedString(),
          publicKey: token.serverPublicKey, algorithm: "SHA256"
        )
      }) else {
        showUnavailable()
        return
      }
      titleLabel.text = preview.title
      icon.image = UIImage(systemName: "checkmark.shield.fill")
      icon.tintColor = .systemBlue
      for label in [accountLabel, serviceLabel, statusLabel] { label.isHidden = false }
      messageLabel.text = preview.question
      accountLabel.text = String(format: text("Account: %@"), preview.account)
      serviceLabel.text = String(format: text("Server: %@"), preview.service)
      serviceLabel.isHidden = preview.service.isEmpty
      let status: String
      switch preview.status {
      case "accepted": status = text("Accepted")
      case "declined": status = text("Declined")
      case "expired": status = text("Expired")
      case "dismissed": status = text("Dismissed")
      default: status = text("Awaiting your response")
      }
      statusLabel.text = status
      if preview.status == "pending" {
        expiryTimer = Timer.scheduledTimer(withTimeInterval: max(0.1, preview.expiresAt.timeIntervalSinceNow), repeats: false) { [weak self] _ in
          guard let self else { return }
          self.statusLabel.text = self.text("Expired")
        }
      }
    } catch {
      showUnavailable()
    }
    view.setNeedsLayout()
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

  deinit { expiryTimer?.invalidate() }
}
