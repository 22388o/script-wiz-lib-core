import CryptoJS from "crypto-js";
import elliptic from "elliptic";
import BN from "bn.js";
import WizData from "@script-wiz/wiz-data";
import bcrypto from "bcrypto";
import { publicKeyTweakCheckWithPrefix } from "./taproot";

// TO DO @afarukcali review

export const ripemd160 = (wizData: WizData): CryptoJS.lib.WordArray => {
  return CryptoJS.RIPEMD160(CryptoJS.enc.Hex.parse(wizData.hex));
};

export const sha1 = (wizData: WizData): CryptoJS.lib.WordArray => {
  return CryptoJS.SHA1(CryptoJS.enc.Hex.parse(wizData.hex));
};

export const sha256 = (wizData: WizData): CryptoJS.lib.WordArray => {
  return CryptoJS.SHA256(CryptoJS.enc.Hex.parse(wizData.hex));
};

export const hash160 = (wizData: WizData): CryptoJS.lib.WordArray => {
  const dataWithSha256Hashed = CryptoJS.SHA256(CryptoJS.enc.Hex.parse(wizData.hex));
  const dataWithRipemd160Hashed = CryptoJS.RIPEMD160(dataWithSha256Hashed);
  return dataWithRipemd160Hashed;
};

export const sha256v2 = (wizData: WizData): string => {
  return CryptoJS.SHA256(CryptoJS.enc.Hex.parse(wizData.hex)).toString();
};

export const hash160v2 = (wizData: WizData): string => {
  const dataWithSha256Hashed = CryptoJS.SHA256(CryptoJS.enc.Hex.parse(wizData.hex));
  const dataWithRipemd160Hashed = CryptoJS.RIPEMD160(dataWithSha256Hashed);
  return dataWithRipemd160Hashed.toString();
};

export const hash256 = (wizData: WizData): CryptoJS.lib.WordArray => {
  const firstSHAHash = CryptoJS.SHA256(CryptoJS.enc.Hex.parse(wizData.hex));
  const secondSHAHash = CryptoJS.SHA256(firstSHAHash);

  return secondSHAHash;
};

export const ecdsaVerify = (sig: WizData, msg: WizData, pubkey: WizData): WizData => {
  const secp256k1 = new elliptic.ec("secp256k1");
  const hashedMessage = sha256(msg).toString();
  const publicKey = pubkey.hex;
  const signature = sig.hex;

  if (publicKey.length !== 66) throw "ECDSA Verify error : invalid public key length";

  if (!signature.startsWith("30")) throw "ECDSA Verify error : signature must start with 0x30";

  const rAndSDataSize = Number("0x" + signature.substr(2, 2));

  const signatureStringLength = rAndSDataSize * 2 + 4;

  if (signature.length !== signatureStringLength) throw "ECDSA Verify error : signature length invalid";

  const rDataSize = Number("0x" + signature.substr(6, 2));

  const rValue = signature.substr(8, rDataSize * 2);

  const sDataSize = Number("0x" + signature.substr(10 + rDataSize * 2, 2));

  const sValue = signature.substr(10 + rDataSize * 2 + 2, sDataSize * 2);

  const rBn = new BN(rValue, "hex");
  const sBn = new BN(sValue, "hex");

  try {
    return WizData.fromNumber(secp256k1.verify(hashedMessage, { r: rBn, s: sBn }, secp256k1.keyFromPublic(publicKey, "hex")) ? 1 : 0);
  } catch {
    throw "ECDSA Verify error : something went wrong";
  }
};

export const checkSig = (wizData: WizData, wizData2: WizData): WizData => {
  // stackData 1 = signature
  // stackData 2 = pubkey
  const signature = wizData.hex;
  const publicKey = wizData2.hex;

  if (publicKey.length !== 68) return WizData.fromNumber(0);

  if (!signature.startsWith("0x30")) return WizData.fromNumber(0);

  const rAndSDataSize = Number("0x" + signature.substr(4, 2));

  const signatureStringLength = rAndSDataSize * 2 + 6;

  if (signature.length !== signatureStringLength) return WizData.fromNumber(0);

  return WizData.fromNumber(1);
};

// taproot feature
export const tweakVerify = (wizData: WizData, wizData2: WizData, wizData3: WizData): WizData => {
  const internalKey = wizData3;
  const vchTweak = wizData2;
  const vchTweakedKey = wizData;

  if (vchTweak.bytes.length != 32) throw "Tweak key length must be eqaul 32 byte";

  if (internalKey.bytes.length != 32) throw "Internal key length must be eqaul 32 byte";

  if (vchTweakedKey.bytes[0] !== 2 && vchTweakedKey.bytes[0] !== 3) throw "Tweaked key must start with 0x02 or 0x03";

  const isChecked: boolean = publicKeyTweakCheckWithPrefix(internalKey, vchTweak, vchTweakedKey);

  return WizData.fromNumber(isChecked ? 1 : 0);
};

export const shnorrSigVerify = (sig: WizData, msg: WizData, pubkey: WizData): WizData => {
  if (pubkey.bytes.length !== 32) throw "Schnorr Verify error : invalid public key length";

  if (sig.bytes.length !== 64) throw "Schnorr Verify error : signature length must be equal 64 byte";

  const publicKey = Buffer.from(pubkey.hex, "hex");
  const signature = Buffer.from(sig.hex, "hex");
  const message = Buffer.from(msg.hex, "hex");

  try {
    return WizData.fromNumber(bcrypto.schnorr.verify(message, signature, publicKey) ? 1 : 0);
  } catch {
    throw "ECDSA Verify error : something went wrong";
  }
};

type Keys = {
  privateKey: WizData;
  publicKey: WizData;
  uncompressedPubKey: WizData;
};

export const secp256k1KeyGenerator = (): Keys => {
  const priKey = bcrypto.secp256k1.privateKeyGenerate();
  const pubKey = bcrypto.secp256k1.publicKeyCreate(priKey);

  const priKeyHex = priKey.toString("hex");
  const pubKeyHex = pubKey.toString("hex");

  const pubKeyAxis = bcrypto.secp256k1.publicKeyExport(pubKey);
  const xAxisHex = pubKeyAxis.x.toString("hex");
  const yAxisHex = pubKeyAxis.y.toString("hex");
  const uncompressedPubKey = "04" + xAxisHex + yAxisHex;

  return { privateKey: WizData.fromHex(priKeyHex), publicKey: WizData.fromHex(pubKeyHex), uncompressedPubKey: WizData.fromHex(uncompressedPubKey) };
};

export const schnorrKeyGenerator = (): Keys => {
  const priKey = bcrypto.schnorr.privateKeyGenerate();
  const pubKey = bcrypto.schnorr.publicKeyCreate(priKey);

  const priKeyHex = priKey.toString("hex");
  const pubKeyHex = pubKey.toString("hex");

  const pubKeyAxis = bcrypto.schnorr.publicKeyExport(pubKey);
  const xAxisHex = pubKeyAxis.x.toString("hex");
  const yAxisHex = pubKeyAxis.y.toString("hex");
  const uncompressedPubKey = "04" + xAxisHex + yAxisHex;

  return { privateKey: WizData.fromHex(priKeyHex), publicKey: WizData.fromHex(pubKeyHex), uncompressedPubKey: WizData.fromHex(uncompressedPubKey) };
};

export const secp256k1Sign = (message: WizData, privateKey: WizData): WizData => {
  const bufferMessage = Buffer.from(message.hex, "hex");
  const bufferPrivateKey = Buffer.from(privateKey.hex, "hex");

  const sign = bcrypto.secp256k1.sign(bufferMessage, bufferPrivateKey);
  const hexSign = sign.toString("hex");

  return WizData.fromHex(hexSign);
};

export const schnorrSign = (message: WizData, privateKey: WizData): WizData => {
  const bufferMessage = Buffer.from(message.hex, "hex");
  const bufferPrivateKey = Buffer.from(privateKey.hex, "hex");
  //const aux = Buffer.from("ffffffffffffffffffffffffffffffff", "hex");

  const sign = bcrypto.schnorr.sign(bufferMessage, bufferPrivateKey);
  const hexSign = sign.toString("hex");

  return WizData.fromHex(hexSign);
};

export const secp256k1Verify = (message: WizData, signature: WizData, publicKey: WizData): WizData => {
  const bufferMessage = Buffer.from(message.hex, "hex");
  const bufferSignature = Buffer.from(signature.hex, "hex");
  const bufferPublicKey = Buffer.from(publicKey.hex, "hex");

  const verify = bcrypto.secp256k1.verify(bufferMessage, bufferSignature, bufferPublicKey);

  return WizData.fromNumber(verify ? 1 : 0);
};

export const secp256k1CreatePublicKey = (privateKey: WizData): Keys => {
  const privateKeyHex = Buffer.from(privateKey.hex, "hex");

  const pubKey = bcrypto.secp256k1.publicKeyCreate(privateKeyHex);
  const pubKeyHex = pubKey.toString("hex");

  const pubKeyAxis = bcrypto.secp256k1.publicKeyExport(pubKey);

  const xAxisHex = pubKeyAxis.x.toString("hex");
  const yAxisHex = pubKeyAxis.y.toString("hex");

  const uncompressedPubKey = "04" + xAxisHex + yAxisHex;

  return { privateKey, publicKey: WizData.fromHex(pubKeyHex), uncompressedPubKey: WizData.fromHex(uncompressedPubKey) };
};

export const schnorrCreatePublicKey = (privateKey: WizData): Keys => {
  const privateKeyHex = Buffer.from(privateKey.hex, "hex");

  const pubKey = bcrypto.schnorr.publicKeyCreate(privateKeyHex);
  const pubKeyHex = pubKey.toString("hex");

  const pubKeyAxis = bcrypto.schnorr.publicKeyExport(pubKey);

  const xAxisHex = pubKeyAxis.x.toString("hex");
  const yAxisHex = pubKeyAxis.y.toString("hex");

  const uncompressedPubKey = "04" + xAxisHex + yAxisHex;

  return { privateKey, publicKey: WizData.fromHex(pubKeyHex), uncompressedPubKey: WizData.fromHex(uncompressedPubKey) };
};

// const ECDSA = (messageHash: string, publicKey: string): string => {
//   const EC = elliptic.ec;

//   // Create and initialize EC context
//   // (better do it once and reuse it)
//   const ec = new EC("secp256k1");

//   // Generate keys
//   const key = ec.genKeyPair();

//   // Sign the message's hash (input must be an array, or a hex-string)
//   const signature = key.sign(messageHash);

//   // Export DER encoded signature in Array
//   const derSign = signature.toDER();

//   return derSign;
// };
