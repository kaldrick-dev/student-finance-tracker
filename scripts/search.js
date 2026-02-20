export function compileRegex(input, flags = "i") {
  try {
    return input ? new RegExp(input, flags) : null;
  } catch {
    return null;
  }
}

export function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function highlight(text, regex) {
  const safe = escapeHtml(String(text));
  if (!regex) return safe;

  const sourceFlags = regex.flags.includes("g") ? regex.flags : `${regex.flags}g`;
  const re = new RegExp(regex.source, sourceFlags);

  return safe.replace(re, (match) => `<mark>${match}</mark>`);
}

export function matchesRecord(record, regex) {
  if (!regex) return true;
  const haystack = `${record.description} ${record.category} ${record.amount} ${record.date}`;
  return regex.test(haystack);
}
