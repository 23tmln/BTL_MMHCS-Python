/**
 * cryptoBackup.js
 * Sử dụng Web Crypto API (được hỗ trợ sẵn trên trình duyệt) để mã hóa/giải mã 
 * toàn bộ Bó Khóa Riêng Tư (Private Key bundles) bằng một Passphrase do người dùng nhập.
 * Sau khi mã hóa, Server chỉ nhận được chuỗi vô nghĩa, đảm bảo server không thể đọc được khóa.
 * 
 * Lược đồ mã hóa:
 *   - Tạo khóa (Key derivation): PBKDF2-SHA256 (100,000 vòng lặp), salt ngẫu nhiên 16-byte
 *   - Mã hóa thực tế: AES-256-GCM, IV ngẫu nhiên 12-byte
 * 
 * Kết quả trả ra dạng JSON chuỗi:
 * {
 *   salt: "<base64>",
 *   iv:   "<base64>",
 *   data: "<base64 AES-GCM ciphertext>"
 * }
 */

function ab2b64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function b642ab(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Derive an AES-256-GCM CryptoKey from a user passphrase and a random salt.
 */
async function deriveKey(passphrase, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100_000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Mã hóa một đối tượng Javascript (chứa gói Key riêng tư) bằng passphrase.
 * Trả về chuỗi JSON an toàn đã mã hóa để gửi lên server lưu trữ.
 */
export async function encryptPrivateBundle(bundleObject, passphrase) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv   = crypto.getRandomValues(new Uint8Array(12));
  const key  = await deriveKey(passphrase, salt);

  const plaintext = new TextEncoder().encode(JSON.stringify(bundleObject));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    plaintext
  );

  return JSON.stringify({
    salt: ab2b64(salt.buffer),
    iv:   ab2b64(iv.buffer),
    data: ab2b64(ciphertext),
  });
}

/**
 * Giải mã chuỗi backup lưu từ server về lại thành Object (chứa gói Key và Session) 
 * bằng passphrase người dùng nhập vào.
 * Sẽ ném ra lỗi nếu passphrase sai hoặc file bị hỏng.
 */
export async function decryptPrivateBundle(encryptedBundleString, passphrase) {
  let parsed;
  try {
    parsed = JSON.parse(encryptedBundleString);
  } catch {
    throw new Error("Invalid backup format");
  }

  const salt = b642ab(parsed.salt);
  const iv   = b642ab(parsed.iv);
  const data = b642ab(parsed.data);
  const key  = await deriveKey(passphrase, salt);

  let plaintext;
  try {
    plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: new Uint8Array(iv) },
      key,
      data
    );
  } catch {
    throw new Error("Decryption failed — wrong passphrase or corrupted backup");
  }

  return JSON.parse(new TextDecoder().decode(plaintext));
}
