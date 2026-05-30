# Khai triển mã nguồn Double Ratchet trong thư viện libsignal-protocol-typescript

Thuật toán Bánh răng kép (Double Ratchet) kết hợp giữa Diffie-Hellman (DH) Ratchet và Symmetric-Key (KDF) Ratchet. Toàn bộ cơ chế này được kích hoạt liên tục mỗi khi một tin nhắn mã hóa bay qua bay lại bằng các lệnh gọi từ tệp `signalHelper.js` tương tác với đối tượng `SessionCipher` của thư viện.

Dưới đây là trích xuất nguyên bản đoạn code cốt lõi từ thư viện `@privacyresearch/libsignal-protocol-typescript`.

## 1. Nơi kích hoạt trong Dự án (signalHelper.js)

Thuật toán xoay khóa được kích hoạt ngầm ở hai hàm gửi và nhận tin:

```javascript
// PHÍA GỬI (signalHelper.js - encryptWithSignal)
// Khi khởi chạy cipher.encrypt(), nó lấy Chain Key (Khóa Chuỗi) hiện tại băm ra Message Key (Khóa Tin nhắn), 
// và dùng khóa đó gắn cho riêng tin nhắn này, đồng thời tịnh tiến Chain Key cũ lên phiên bản mới.
const ciphertextMessage = await cipher.encrypt(plaintextBuffer);

// PHÍA NHẬN (signalHelper.js - decryptWithSignal)
// Khi chạy decryptWhisperMessage(), giao thức đối chiếu Ephemeral key (Khóa tạm thời) từ đầu gửi truyền qua mạng. 
// Nếu phát hiện là khóa tạm thời mới, nó xoay DH Ratchet. Sau đó xoay KDF Ratchet tạo ra đúng cấu trúc Message Key khớp với đầu kia để giải mã.
plaintextBuffer = await cipher.decryptWhisperMessage(ciphertextBinary, 'binary');
```

---

## 2. Mã Nguồn Lõi Bánh răng Diffie-Hellman (DH Ratchet)

**DH Ratchet** là module thiết lập lại các cụm **Khóa Rễ (Root Key)** và **Khóa Chuỗi (Chain Key)** mỗi khi một trong hai thiết bị gửi đến một `Ephemeral Key` (Khóa công khai tạm thời) mới. Quá trình này giúp hệ thống đạt chuẩn "Tự khắc phục" (Self-Healing / Post-Compromise Security).

```javascript
/**
 * Trích xuất từ node_modules/@privacyresearch/libsignal-protocol-typescript/lib/session-cipher.js
 * DH Ratchet Step: Phản ứng khi đầu kia vừa cung cấp cặp Khóa Tạm thời mới.
 */
this.maybeStepRatchet = async (session, remoteKey, previousCounter) => {
    // remoteKey chứa Ephemeral Public Key mới của đối tác
    const remoteKeyString = base64.fromByteArray(new Uint8Array(remoteKey));
    
    // Nếu chuỗi của khóa tạm thời này đã được thiết lập -> Cấu trúc không mới -> Bỏ qua
    if (session.chains[remoteKeyString] !== undefined) {
        return Promise.resolve();
    }
    
    const ratchet = session.currentRatchet;
    
    // ... [Phần code xử lý chốt sổ những Ratchet Message Keys chưa nhận của chuỗi cũ] ...
    
    // BƯỚC 1: Cập nhật Ratchet tính toán rẽ nhánh cho khối Chuỗi Nhận Tin (Dựa vào Ephemeral Key mới của họ)
    await this.calculateRatchet(session, remoteKey, false);
    
    // BƯỚC 2: Tự ngẫu nhiên sinh ra cho chúng ta một đôi khóa Tạm thời EphemeralKeyPair mới toanh
    const keyPair = await Internal.crypto.createKeyPair();
    ratchet.ephemeralKeyPair = keyPair;
    
    // BƯỚC 3: Cập nhật Ratchet tính toán khối Chuỗi Gửi Tin (Để hồi đáp bằng cụm Ephemeral mới này)
    await this.calculateRatchet(session, remoteKey, true);
    ratchet.lastRemoteEphemeralKey = remoteKey; // Cập nhật lại trạng thái Ephemeral mới nhất của đối tác
};

/**
 * Thuật toán tính toán rẽ nhánh cấp độ Root (Toán Học ECDHE kết hợp HKDF)
 */
this.calculateRatchet = async (session, remoteKey, sending) => {
    const ratchet = session.currentRatchet;
    
    // Dùng ECDHE nhân Khóa bí mật tạm thời (Ephemeral Private) của mình với Khóa công khai tạm thời của đối tác 
    const sharedSecret = await Internal.crypto.ECDHE(remoteKey, ratchet.ephemeralKeyPair.privKey);
    
    // Hàm Dẫn xuất khóa HKDF: Biến Shared Secret và Khóa Rễ Thành mảng Master 
    // masterKey[0]: Khóa Rễ Mới (Root Key v2) dành để nhân tiếp cho lần Ratchet Step sau.
    // masterKey[1]: Khóa Chuỗi Mới (Chain Key v1) chìa khóa mồi cho Symmetric KDF Ratchet băm ra các Khóa tin nhắn.
    const masterKey = await Internal.HKDF(sharedSecret, ratchet.rootKey, 'WhisperRatchet');
    
    // Nối Khóa Chuỗi Mới vào cây giao dịch phiên theo loại hình GỬI hay NHẬN
    let ephemeralPublicKey = sending ? ratchet.ephemeralKeyPair.pubKey : remoteKey;
    session.chains[base64.fromByteArray(new Uint8Array(ephemeralPublicKey))] = {
        messageKeys: {},
        chainKey: { counter: -1, key: masterKey[1] },
        chainType: sending ? ChainType.SENDING : ChainType.RECEIVING,
    };
    
    // THAY THẾ KHÓA RỄ VĨNH VIỄN BẰNG KHÓA RỄ MỚI (Thuật toán tự tiến hóa vô vãn)
    ratchet.rootKey = masterKey[0];
};
```

---

## 3. Mã Nguồn Lõi Bánh Răng Mã Hóa Đối Xứng (Symmetric-Key/KDF Ratchet)

**Symmetric Ratchet** liên tục quay khi các tin nhắn được nhắn nhủ trong CÙNG MỘT cụm Ephemeral Key chưa đổi. Nó chỉ băm một chiều tiến lên phía trước. Đảm bảo đạt đặc tính siêu việt của E2EE: **Bảo mật chuyển tiếp (Forward Secrecy)**. Bị lộ Khóa Tin Nhắn ngày hôm nay không hề ảnh hưởng đến Khóa Tin Nhắn của hôm qua.

```javascript
/**
 * Trích xuất từ node_modules/@privacyresearch/libsignal-protocol-typescript/lib/session-cipher.js
 * Quá trình tịnh tiến (Ratchet Step) sử dụng Key Derivation Function (thông qua hàm HMAC Ký Điện Tử).
 */
this.fillMessageKeys = async (chain, counter) => {
    // Nếu tin nhắn có counter <= số counter đang tính sẵn, nghĩa là chưa phải đẩy thêm -> Bỏ qua
    if (chain.chainKey.counter >= counter) {
        return Promise.resolve(); 
    }
    
    const ckey = chain.chainKey.key; 
    
    // THEO CHUẨN DOUBLE RATCHET KDF: Dùng hàm `sign` (HMAC-SHA256) băm mảng tạo Message Key và Chain Key kết tiếp.
    
    // Khối 1: Ký đoạn số 0x01 với Chain Key hiện tại -> Đẻ ra Message Key 
    const byteArray = new Uint8Array(1);
    byteArray[0] = 1;
    const mac = await Internal.crypto.sign(ckey, byteArray.buffer); 
    
    // Khối 2: Ký đoạn 0x02 với Chain Key hiện tại -> Đẻ ra Cặp Chain Key Kế Nhiệm
    byteArray[0] = 2;
    const key = await Internal.crypto.sign(ckey, byteArray.buffer); 
    
    // Trỏ Message Key vào kho lưu đệm để dùng mã hóa tin số [counter + 1]
    chain.messageKeys[chain.chainKey.counter + 1] = mac;
    
    // THUẬT TOÁN ĐÈ BIẾN TOÀN MÃ: Thay thế Chain Key gốc rễ bằng Chain Key Kế Nhiệm
    // Khóa Ckey cũ của hệ thống JavaScript bị Garbage Collector vứt bỏ hoàn toàn -> Dấu vết vĩnh viễn biến mất!!
    chain.chainKey.key = key;
    
    // Tịnh tiến số đếm vòng đời + 1
    chain.chainKey.counter += 1;
    
    // Gọi Đệ Quy: Cho đến khi bộ đếm counter bằng với counter chuỗi yêu cầu của hệ thống nhắn.
    await this.fillMessageKeys(chain, counter);
};
```
