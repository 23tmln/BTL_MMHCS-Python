import cloudinary from "../lib/cloudinary.js";
import { getReceiverSocketId, io } from "../lib/socket.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import axios from "axios";

export const getAllContacts = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    const filteredUsers = await User.find({ _id: { $ne: loggedInUserId } }).select("-password");

    res.status(200).json(filteredUsers);
  } catch (error) {
    console.log("Error in getAllContacts:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getMessagesByUserId = async (req, res) => {
  try {
    const myId = req.user._id;
    const { id: userToChatId } = req.params;

    const messages = await Message.find({
      $or: [
        { senderId: myId, receiverId: userToChatId },
        { senderId: userToChatId, receiverId: myId },
      ],
    });

    const decryptedMessages = await Promise.all(
      messages.map(async (msg) => {
        const msgObj = msg.toObject();
        if (msgObj.isEncrypted) {
          try {
            const decryptRes = await axios.post(`${process.env.CRYPTO_SERVICE_URL}/decrypt`, {
              from: msgObj.senderId.toString(),
              to: msgObj.receiverId.toString(),
              ciphertext: msgObj.ciphertext,
              messageType: msgObj.messageType,
              sessionId: msgObj.sessionId,
            });
            msgObj.text = decryptRes.data.plaintext;
          } catch (error) {
            console.error("Decryption error:", error.message);
            msgObj.text = "[Cannot decrypt]";
          }
        }
        return msgObj;
      })
    );

    res.status(200).json(decryptedMessages);
  } catch (error) {
    console.log("Error in getMessages controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { text, image } = req.body;
    const { id: receiverId } = req.params;
    const senderId = req.user._id;

    if (!text && !image) {
      return res.status(400).json({ message: "Text or image is required." });
    }
    if (senderId.equals(receiverId)) {
      return res.status(400).json({ message: "Cannot send messages to yourself." });
    }
    const receiverExists = await User.exists({ _id: receiverId });
    if (!receiverExists) {
      return res.status(404).json({ message: "Receiver not found." });
    }

    let imageUrl;
    if (image) {
      // upload base64 image to cloudinary
      const uploadResponse = await cloudinary.uploader.upload(image);
      imageUrl = uploadResponse.secure_url;
    }

    let isEncrypted = false;
    let cryptoData = {};

    if (text) {
      let recipientBundle;
      try {
        const bundleRes = await axios.get(`${process.env.CRYPTO_SERVICE_URL}/bundle/${receiverId}`);
        recipientBundle = bundleRes.data;
      } catch (error) {
        await axios.post(`${process.env.CRYPTO_SERVICE_URL}/generate-keys`, { userId: receiverId });
        const bundleRes = await axios.get(`${process.env.CRYPTO_SERVICE_URL}/bundle/${receiverId}`);
        recipientBundle = bundleRes.data;
      }

      try {
        await axios.get(`${process.env.CRYPTO_SERVICE_URL}/bundle/${senderId}`);
      } catch (error) {
        await axios.post(`${process.env.CRYPTO_SERVICE_URL}/generate-keys`, { userId: senderId });
      }

      const encryptRes = await axios.post(`${process.env.CRYPTO_SERVICE_URL}/encrypt`, {
        from: senderId.toString(),
        to: receiverId.toString(),
        plaintext: text,
        recipientBundle,
      });

      cryptoData = {
        ciphertext: encryptRes.data.ciphertext,
        messageType: encryptRes.data.messageType,
        sessionId: encryptRes.data.sessionId,
      };
      isEncrypted = true;
    }

    const newMessageData = {
      senderId,
      receiverId,
      image: imageUrl,
    };

    if (isEncrypted) {
      newMessageData.isEncrypted = true;
      newMessageData.ciphertext = cryptoData.ciphertext;
      newMessageData.messageType = cryptoData.messageType;
      newMessageData.sessionId = cryptoData.sessionId;
    } else {
      newMessageData.text = text;
    }

    const newMessage = new Message(newMessageData);
    await newMessage.save();

    const messageForSocket = newMessage.toObject();
    if (isEncrypted) {
      messageForSocket.text = text;
      delete messageForSocket.ciphertext;
      delete messageForSocket.messageType;
      delete messageForSocket.sessionId;
    }

    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", messageForSocket);
    }

    res.status(201).json(messageForSocket);
  } catch (error) {
    console.log("Error in sendMessage controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getChatPartners = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;

    // find all the messages where the logged-in user is either sender or receiver
    const messages = await Message.find({
      $or: [{ senderId: loggedInUserId }, { receiverId: loggedInUserId }],
    });

    const chatPartnerIds = [
      ...new Set(
        messages.map((msg) =>
          msg.senderId.toString() === loggedInUserId.toString()
            ? msg.receiverId.toString()
            : msg.senderId.toString()
        )
      ),
    ];

    const chatPartners = await User.find({ _id: { $in: chatPartnerIds } }).select("-password");

    res.status(200).json(chatPartners);
  } catch (error) {
    console.error("Error in getChatPartners: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};
