const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Shows an example sentence with the studied word (or any of its forms) marked like a highlighter pen. */
export default function Highlight({ text, terms }: { text: string; terms: string[] }) {
  const words = [...new Set(terms.filter(Boolean))].sort((a, b) => b.length - a.length);
  if (words.length === 0) return <>{text}</>;
  const re = new RegExp(`(?<!\\p{L})(${words.map(escapeRe).join("|")})(?!\\p{L})`, "giu");
  const parts = text.split(re);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark
            key={i}
            className="rounded-md bg-transparent bg-[linear-gradient(transparent_45%,var(--color-marker)_45%,var(--color-marker)_92%,transparent_92%)] px-0.5 font-bold text-deep [box-decoration-break:clone]"
          >
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}
