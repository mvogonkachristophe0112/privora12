import CryptoJS from 'crypto-js'

const SECRET_KEY = process.env.ENCRYPTION_KEY || 'default-secret-key'

export function encryptFile(buffer: ArrayBuffer, password: string): string {
  const wordArray = CryptoJS.lib.WordArray.create(buffer)
  const encrypted = CryptoJS.AES.encrypt(wordArray, password).toString()
  return encrypted
}

export function decryptFile(encryptedData: string, password: string): ArrayBuffer {
  const decrypted = CryptoJS.AES.decrypt(encryptedData, password)
  const buffer = wordArrayToArrayBuffer(decrypted)
  return buffer
}

function wordArrayToArrayBuffer(wordArray: CryptoJS.lib.WordArray): ArrayBuffer {
  const arrayOfWords = wordArray.hasOwnProperty('words') ? wordArray.words : []
  const length = wordArray.hasOwnProperty('sigBytes') ? wordArray.sigBytes : arrayOfWords.length * 4
  const uInt8Array = new Uint8Array(length)
  let index = 0
  let word: number
  let i: number
  for (i = 0; i < length; i++) {
    word = arrayOfWords[i]
    uInt8Array[index++] = word >> 24
    uInt8Array[index++] = (word >> 16) & 0xff
    uInt8Array[index++] = (word >> 8) & 0xff
    uInt8Array[index++] = word & 0xff
  }
  return uInt8Array.buffer.slice(0, length)
}

export function generateKey(): string {
  return CryptoJS.lib.WordArray.random(256/8).toString()
}