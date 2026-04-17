/**
 * SHA-256 via Web Crypto API (disponible en todos los navegadores modernos).
 * Devuelve el hash como string hexadecimal de 64 caracteres.
 * NUNCA almacenar PINs en texto plano — usar siempre esta función.
 */
export async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str))
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}
