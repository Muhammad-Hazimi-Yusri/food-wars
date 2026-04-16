function execCommandFallback(text: string): boolean {
  if (typeof document === "undefined") return false;
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.top = "0";
    textarea.style.left = "0";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

// Safari iOS rejects navigator.clipboard.writeText() if any `await` runs
// between the user gesture and the call. Passing a Promise to ClipboardItem
// preserves user-activation across the async work, which is the only reliable
// pattern for "fetch then copy" flows on iOS.
export async function copyDeferredText(
  getText: () => Promise<string>,
): Promise<boolean> {
  if (
    typeof window !== "undefined" &&
    typeof window.ClipboardItem !== "undefined" &&
    navigator.clipboard?.write
  ) {
    try {
      const blobPromise = getText().then(
        (text) => new Blob([text], { type: "text/plain" }),
      );
      await navigator.clipboard.write([
        new ClipboardItem({ "text/plain": blobPromise }),
      ]);
      return true;
    } catch (err) {
      // If getText() itself rejected, surface that to the caller so they can
      // distinguish "fetch failed" from "clipboard refused".
      if (err instanceof DOMException || isClipboardError(err)) {
        // fall through to fallback paths
      } else {
        throw err;
      }
    }
  }

  let text: string;
  try {
    text = await getText();
  } catch (err) {
    throw err;
  }

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through
  }

  return execCommandFallback(text);
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through
  }
  return execCommandFallback(text);
}

function isClipboardError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const name = err.name;
  return (
    name === "NotAllowedError" ||
    name === "TypeError" ||
    name === "SecurityError" ||
    name === "DataError"
  );
}
