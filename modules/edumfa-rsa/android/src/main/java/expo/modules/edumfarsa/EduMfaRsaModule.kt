package expo.modules.edumfarsa

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.security.KeyFactory
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.PrivateKey
import java.security.PublicKey
import java.security.Signature
import java.security.spec.X509EncodedKeySpec

private const val ANDROID_KEYSTORE = "AndroidKeyStore"
private const val RSA_ALGORITHM = KeyProperties.KEY_ALGORITHM_RSA
private const val SHA256_WITH_RSA = "SHA256withRSA"
private const val SHA512_WITH_RSA = "SHA512withRSA"
private const val SHA1_WITH_RSA = "SHA1withRSA"
private const val SHA256 = "SHA256"
private const val SHA512 = "SHA512"
private const val SHA1 = "SHA1"

private val RSA_ALGORITHM_IDENTIFIER = byteArrayOf(
  0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86.toByte(), 0x48, 0x86.toByte(),
  0xf7.toByte(), 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00
)

class EduMfaRsaModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("EduMfaRsa")

    Constant("SHA256") { SHA256 }
    Constant("SHA512") { SHA512 }
    Constant("SHA1") { SHA1 }

    AsyncFunction("generateKeyPair") { keyAlias: String, keySize: Int ->
      mapOf("publicKey" to generateKeyPair(keyAlias, keySize))
    }

    AsyncFunction("getPublicKey") { keyAlias: String ->
      mapOf("publicKey" to getPublicKeyPem(keyAlias))
    }

    AsyncFunction("sign") { message: String, keyAlias: String, algorithm: String ->
      sign(message, keyAlias, algorithm)
    }

    AsyncFunction("verify") { message: String, signatureBase64: String, publicKey: String, algorithm: String ->
      verify(message, signatureBase64, publicKey, algorithm)
    }

    AsyncFunction("deleteKeyPair") { keyAlias: String ->
      deleteKeyPair(keyAlias)
    }
  }

  private fun generateKeyPair(keyAlias: String, keySize: Int): String {
    validateKeyAlias(keyAlias)
    validateKeySize(keySize)

    val keyStore = getKeyStore()
    if (keyStore.containsAlias(keyAlias)) {
      keyStore.deleteEntry(keyAlias)
    }

    val generator = KeyPairGenerator.getInstance(RSA_ALGORITHM, ANDROID_KEYSTORE)
    val spec = KeyGenParameterSpec.Builder(
      keyAlias,
      KeyProperties.PURPOSE_SIGN or KeyProperties.PURPOSE_VERIFY
    )
      .setKeySize(keySize)
      .setDigests(
        KeyProperties.DIGEST_SHA256,
        KeyProperties.DIGEST_SHA512,
        KeyProperties.DIGEST_SHA1
      )
      .setSignaturePaddings(KeyProperties.SIGNATURE_PADDING_RSA_PKCS1)
      .setUserAuthenticationRequired(false)
      .build()

    generator.initialize(spec)
    val keyPair = generator.generateKeyPair()
    return pem("PUBLIC KEY", keyPair.public.encoded)
  }

  private fun getPublicKeyPem(keyAlias: String): String {
    validateKeyAlias(keyAlias)
    return pem("PUBLIC KEY", getPrivateKeyEntry(keyAlias).certificate.publicKey.encoded)
  }

  private fun sign(message: String, keyAlias: String, algorithm: String): String {
    validateKeyAlias(keyAlias)

    val privateKey = getPrivateKeyEntry(keyAlias).privateKey
    val signature = Signature.getInstance(signatureAlgorithm(algorithm))
    signature.initSign(privateKey)
    signature.update(message.toByteArray(Charsets.UTF_8))
    return Base64.encodeToString(signature.sign(), Base64.NO_WRAP)
  }

  private fun verify(
    message: String,
    signatureBase64: String,
    publicKey: String,
    algorithm: String
  ): Boolean {
    val signatureBytes = Base64.decode(signatureBase64, Base64.DEFAULT)
    val verifier = Signature.getInstance(signatureAlgorithm(algorithm))
    verifier.initVerify(parsePublicKey(publicKey))
    verifier.update(message.toByteArray(Charsets.UTF_8))
    return verifier.verify(signatureBytes)
  }

  private fun deleteKeyPair(keyAlias: String): Boolean {
    validateKeyAlias(keyAlias)
    val keyStore = getKeyStore()
    if (keyStore.containsAlias(keyAlias)) {
      keyStore.deleteEntry(keyAlias)
    }
    return true
  }

  private fun getPrivateKeyEntry(keyAlias: String): KeyStore.PrivateKeyEntry {
    val keyStore = getKeyStore()
    val entry = keyStore.getEntry(keyAlias, null)
    if (entry !is KeyStore.PrivateKeyEntry) {
      throw IllegalStateException("No RSA private key found for alias '$keyAlias'.")
    }

    val privateKey: PrivateKey = entry.privateKey
    if (privateKey.algorithm != RSA_ALGORITHM) {
      throw IllegalStateException("Key '$keyAlias' is not an RSA private key.")
    }

    return entry
  }

  private fun getKeyStore(): KeyStore {
    return KeyStore.getInstance(ANDROID_KEYSTORE).apply {
      load(null)
    }
  }

  private fun parsePublicKey(publicKey: String): PublicKey {
    val der = decodePemBody(publicKey)
    val keyFactory = KeyFactory.getInstance(RSA_ALGORITHM)

    return try {
      keyFactory.generatePublic(X509EncodedKeySpec(der))
    } catch (_: Exception) {
      keyFactory.generatePublic(X509EncodedKeySpec(wrapPkcs1PublicKeyInSubjectPublicKeyInfo(der)))
    }
  }

  private fun decodePemBody(key: String): ByteArray {
    var body = key
      .replace(Regex("-----BEGIN [^-]+-----"), "")
      .replace(Regex("-----END [^-]+-----"), "")
      .replace(Regex("\\s"), "")
      .replace('-', '+')
      .replace('_', '/')

    if (body.isBlank()) {
      throw IllegalArgumentException("The RSA public key is empty.")
    }

    val paddingLength = (4 - (body.length % 4)) % 4
    if (paddingLength > 0) {
      body += "=".repeat(paddingLength)
    }

    return Base64.decode(body, Base64.DEFAULT)
  }

  private fun wrapPkcs1PublicKeyInSubjectPublicKeyInfo(pkcs1: ByteArray): ByteArray {
    val bitString = byteArrayOf(0x03) +
      derLength(pkcs1.size + 1) +
      byteArrayOf(0x00) +
      pkcs1
    val body = RSA_ALGORITHM_IDENTIFIER + bitString
    return byteArrayOf(0x30) + derLength(body.size) + body
  }

  private fun derLength(length: Int): ByteArray {
    if (length < 128) {
      return byteArrayOf(length.toByte())
    }

    var value = length
    val bytes = mutableListOf<Byte>()
    while (value > 0) {
      bytes.add(0, (value and 0xff).toByte())
      value = value ushr 8
    }

    return byteArrayOf((0x80 or bytes.size).toByte()) + bytes.toByteArray()
  }

  private fun pem(label: String, data: ByteArray): String {
    val base64 = Base64.encodeToString(data, Base64.NO_WRAP)
    return "-----BEGIN $label-----\n${base64.chunked(64).joinToString("\n")}\n-----END $label-----"
  }

  private fun validateKeyAlias(keyAlias: String) {
    require(keyAlias.isNotBlank()) {
      "Key alias must not be empty."
    }
  }

  private fun validateKeySize(keySize: Int) {
    require(keySize >= 2048 && keySize % 1024 == 0) {
      "Invalid RSA key size: $keySize."
    }
  }

  private fun signatureAlgorithm(algorithm: String): String {
    return when (algorithm) {
      SHA256 -> SHA256_WITH_RSA
      SHA512 -> SHA512_WITH_RSA
      SHA1 -> SHA1_WITH_RSA
      else -> throw IllegalArgumentException("Unsupported RSA signature algorithm: $algorithm.")
    }
  }
}
