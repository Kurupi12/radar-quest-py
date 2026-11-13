/**
 * Utilidades de privacidad para impedir que se registren, expongan o rendericen
 * correos electrónicos en lugar del nombre o nick público de los cazadores.
 */

const EMAIL_PATTERN = /([a-zA-Z0-9._%+-]+)@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;

/**
 * Devuelve true si el texto parece un correo electrónico o contiene uno embebido
 * (incluyendo variantes con '@' antepuesto como "@usuario@gmail.com").
 */
export function containsEmailInAlias(raw: string | null | undefined): boolean {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return false;
  const withoutLeadingAt = trimmed.replace(/^@+/, "");
  if (withoutLeadingAt.includes("@")) return true;
  EMAIL_PATTERN.lastIndex = 0;
  return EMAIL_PATTERN.test(withoutLeadingAt);
}

/**
 * Sanitiza cualquier alias/nombre público o histórico ya almacenado para que
 * nunca muestre un dominio de correo electrónico, conservando solo el nombre o nick.
 */
export function sanitizePublicAlias(
  rawAlias: string | null | undefined,
  fallback = "@cazador"
): string {
  const trimmed = String(rawAlias || "").trim();
  if (!trimmed) return fallback;

  const hadLeadingAt = trimmed.startsWith("@");
  const withoutLeadingAt = trimmed.replace(/^@+/, "").trim();
  if (!withoutLeadingAt) return fallback;

  // Caso "@usuario@dominio.tld" o "usuario@dominio.tld"
  const directEmailMatch = withoutLeadingAt.match(
    /^([^\s@]+)@[a-zA-Z0-9.-]+(?:\.[a-zA-Z]{2,})?$/
  );
  if (directEmailMatch) {
    const localNick = directEmailMatch[1].trim();
    if (localNick.length >= 2) {
      return hadLeadingAt ? `@${localNick}` : localNick;
    }
    return fallback;
  }

  // Caso texto mixto con algún correo embebido
  EMAIL_PATTERN.lastIndex = 0;
  let cleaned = withoutLeadingAt.replace(EMAIL_PATTERN, "$1").trim();

  // Defensa adicional ante correos truncados con '@' en posición intermedia
  const extraAtIdx = cleaned.indexOf("@");
  if (extraAtIdx !== -1) {
    cleaned = cleaned.slice(0, extraAtIdx).trim();
  }

  if (cleaned.length < 2) return fallback;
  return hadLeadingAt ? `@${cleaned}` : cleaned;
}

/**
 * Valida y normaliza el nombre/nick durante el registro (Onboarding).
 * Rechaza correos electrónicos explícitos o implícitos por privacidad.
 */
export function validateRegistrationAlias(
  rawAlias: string
): { ok: true; alias: string } | { ok: false; message: string } {
  const trimmed = String(rawAlias || "").trim();
  if (containsEmailInAlias(trimmed)) {
    return {
      ok: false,
      message:
        "Por seguridad y privacidad no uses tu correo electrónico; ingresá solo tu nombre o nick.",
    };
  }

  const collapsed = trimmed.replace(/\s+/g, " ");
  const stripped = collapsed.replace(/^@+/, "").trim();
  if (stripped.length < 2) {
    return {
      ok: false,
      message: "Ingresá tu Nombre o Nick (mínimo 2 caracteres, sin correo).",
    };
  }

  const finalAlias =
    collapsed.startsWith("@") || /\s/.test(stripped)
      ? collapsed
      : `@${stripped}`;

  return {
    ok: true,
    alias: finalAlias,
  };
}
