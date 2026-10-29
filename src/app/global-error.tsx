'use client';

/**
 * Last-resort boundary: catches failures in the root layout itself, where no
 * fonts, styles or providers can be assumed to have loaded.
 *
 * For that reason this file uses inline styles only. Reaching for the design
 * system here would be exactly the dependency that is already broken.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="uz">
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          padding: '2rem',
          textAlign: 'center',
          backgroundColor: '#FBF7F0',
          color: '#2E1C12',
          fontFamily: 'Georgia, serif',
        }}
      >
        <h1 style={{ fontSize: '1.75rem', fontWeight: 500, margin: 0 }}>
          Samarkhand Hotel
        </h1>
        <p style={{ maxWidth: '28rem', lineHeight: 1.6, color: '#8A5A33' }}>
          Saytni yuklab boʻlmadi. Sahifani yangilab koʻring yoki birozdan soʻng
          qayta kiring.
        </p>
        {error.digest ? (
          <p style={{ fontSize: '0.75rem', color: '#A9784B' }}>
            Xatolik kodi: {error.digest}
          </p>
        ) : null}
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: '0.5rem',
            minHeight: '2.75rem',
            padding: '0 1.5rem',
            borderRadius: '0.625rem',
            border: 'none',
            backgroundColor: '#6B4226',
            color: '#FBF7F0',
            fontSize: '0.9375rem',
            cursor: 'pointer',
          }}
        >
          Qayta urinish
        </button>
      </body>
    </html>
  );
}
