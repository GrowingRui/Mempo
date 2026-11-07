const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Shows an example sentence with the studied word (or any of its forms) in bold. */
export default function Highlight({ text, terms }: { text: string; terms: string[] }) {
  const words = [...new Set(terms.filter(Boolean))].sort((a, b) => b.length - a.length);
  if (words.length === 0) return <>{text}</>;
  const re = new RegExp(`(?<!\\p{L})(${words.map(escapeRe).join("|")})(?!\\p{L})`, "giu");
  const parts = text.split(re);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <strong key={i} className="font-semibold text-ink">
            {part}
          </strong>
        ) : (
          part
        ),
      )}
    </>
  );
}
