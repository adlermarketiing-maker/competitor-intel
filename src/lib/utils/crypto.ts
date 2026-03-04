import CryptoJS from 'crypto-js'

const KEY = process.env.APP_ENCRYPTION_KEY!

if (!KEY) {
  throw new Error('APP_ENCRYPTION_KEY environment variable is not set')
}

export function encrypt(text: string): string {
  return CryptoJS.AES.encrypt(text, KEY).toString()
}

export function decrypt(ciphertext: string): string {
  const bytes = CryptoJS.AES.decrypt(ciphertext, KEY)
  return bytes.toString(CryptoJS.enc.Utf8)
}
