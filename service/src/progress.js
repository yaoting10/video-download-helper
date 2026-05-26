export function parseYtDlpProgress(line) {
  const match = String(line).trim().match(/^(?:download:\s*)?([0-9]+(?:\.[0-9]+)?)%\s*(.*)$/);
  if (!match) {
    return null;
  }

  const percent = Number(match[1]);
  return {
    percent,
    statusText: `${match[1]}% ${match[2].trim()}`.trim().replace(/\s+/g, ' ')
  };
}
