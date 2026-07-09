

export function sanitizeText(innerHtml: string) {
  // 1. Create a temporary element (not a text node)
  const tempElement = document.createElement('div');

// 2. Insert your HTML string
  tempElement.innerHTML = innerHtml;

// 3. Extract clean text with no styles or tags
  const cleanText = tempElement.textContent || "";
  return cleanText;
}
