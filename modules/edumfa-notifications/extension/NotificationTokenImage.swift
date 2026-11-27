import Foundation
import ImageIO
import UniformTypeIdentifiers

final class NotificationTokenImage: NSObject, URLSessionTaskDelegate {
  static let attachmentIdentifier = "edumfa-token-image"

  static func download(_ value: String) async throws -> Data? {
    guard let url = URL(string: value), url.scheme?.lowercased() == "https",
          url.host != nil, url.user == nil, url.password == nil else { return nil }
    let maxBytes = 512 * 1024
    let configuration = URLSessionConfiguration.ephemeral
    configuration.timeoutIntervalForRequest = 5
    configuration.timeoutIntervalForResource = 5
    let session = URLSession(configuration: configuration, delegate: NotificationTokenImage(), delegateQueue: nil)
    defer { session.invalidateAndCancel() }
    let (bytes, response) = try await session.bytes(from: url)
    guard (response as? HTTPURLResponse)?.statusCode == 200,
          response.expectedContentLength <= Int64(maxBytes) else { return nil }

    var data = Data()
    for try await byte in bytes {
      guard data.count < maxBytes else { return nil }
      data.append(byte)
    }
    return thumbnailPNG(data)
  }

  static func thumbnailPNG(_ data: Data) -> Data? {
    guard let source = CGImageSourceCreateWithData(data as CFData, nil),
          let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [String: Any],
          let width = properties[kCGImagePropertyPixelWidth as String] as? Int,
          let height = properties[kCGImagePropertyPixelHeight as String] as? Int,
          (1...4096).contains(width), (1...4096).contains(height),
          let thumbnail = CGImageSourceCreateThumbnailAtIndex(source, 0, [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceThumbnailMaxPixelSize: 160,
          ] as CFDictionary) else { return nil }

    let png = NSMutableData()
    guard let destination = CGImageDestinationCreateWithData(png, UTType.png.identifier as CFString, 1, nil)
    else { return nil }
    CGImageDestinationAddImage(destination, thumbnail, nil)
    return CGImageDestinationFinalize(destination) ? png as Data : nil
  }

  func urlSession(
    _ session: URLSession,
    task: URLSessionTask,
    willPerformHTTPRedirection response: HTTPURLResponse,
    newRequest request: URLRequest,
    completionHandler: @escaping (URLRequest?) -> Void
  ) {
    completionHandler(nil)
  }
}
