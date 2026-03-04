import CryptoJS from 'crypto-js'

function getKey(): string {
  const key = process.env.APP_ENCRYPTION_KEY
  if (!key) throw new Error('APP_ENCRYPTION_KEY environment variable is not set')
  return key
}

export function encrypt(text: string): string {
  return CryptoJS.AES.encrypt(text, getKey()).toString()
}

export function decrypt(ciphertext: string): string {
  const bytes = CryptoJS.AES.decrypt(ciphertext, getKey())
  return bytes.toString(CryptoJS.enc.Utf8)
}
